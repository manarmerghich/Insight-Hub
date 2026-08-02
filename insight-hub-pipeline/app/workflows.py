from app.db import get_connection, update_run_status
from app.dedup import insert_messages
from app.filtering import matches_keyword
from app.normalize import normalize_row


async def normalize_step(*, rows: list[dict]) -> list[dict]:
    return [normalize_row(row) for row in rows]


async def filter_step(*, rows: list[dict], keyword: str) -> list[dict]:
    return [row for row in rows if matches_keyword(row["text"], keyword)]


async def dedup_and_write_step(
    *, run_id: int, source_filename: str, keyword: str, rows: list[dict]
) -> dict:
    conn = get_connection()
    try:
        inserted_count = insert_messages(conn, run_id, source_filename, keyword, rows)
    finally:
        conn.close()
    # rows here are already keyword-filtered but pre-dedup, so len(rows) is the
    # match count — distinct from inserted_count, which drops already-seen messages.
    return {"matched_count": len(rows), "inserted_count": inserted_count}


async def finalize_success_step(*, run_id: int, matched_count: int, retained_count: int) -> None:
    conn = get_connection()
    try:
        update_run_status(
            conn, run_id, "completed", matched_count=matched_count, retained_count=retained_count
        )
    finally:
        conn.close()


async def finalize_error_step(*, run_id: int, error_message: str) -> None:
    conn = get_connection()
    try:
        update_run_status(conn, run_id, "error", error_message=error_message)
    finally:
        conn.close()


async def run_import_pipeline(
    *, run_id: int, keyword: str, source_filename: str, rows: list[dict]
) -> dict:
    # Plain sequential pipeline: no durable orchestration (Vercel Workflows'
    # Python SDK is beta and its dispatch can't be exercised locally/CI —
    # see ARCHITECTURE.md). A failed run can simply be resubmitted, since
    # dedup_and_write_step's ON CONFLICT DO NOTHING makes reprocessing the
    # same rows safe.
    try:
        normalized = await normalize_step(rows=rows)
        filtered = await filter_step(rows=normalized, keyword=keyword)
        result = await dedup_and_write_step(
            run_id=run_id,
            source_filename=source_filename,
            keyword=keyword,
            rows=filtered,
        )
        await finalize_success_step(
            run_id=run_id,
            matched_count=result["matched_count"],
            retained_count=result["inserted_count"],
        )
        return {"status": "completed", **result}
    except Exception as exc:
        await finalize_error_step(run_id=run_id, error_message=str(exc))
        return {"status": "error", "error_message": str(exc)}
