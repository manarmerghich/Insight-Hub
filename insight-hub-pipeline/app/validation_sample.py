from datetime import datetime, timezone

from app.sentiment import VALID_SENTIMENTS

DEFAULT_SAMPLE_SIZE_PER_CLASS = 30


def draw_validation_sample(conn, *, sample_size_per_class: int = DEFAULT_SAMPLE_SIZE_PER_CLASS) -> dict:
    sampled_by_class: dict[str, list[dict]] = {}
    under_represented: list[str] = []

    with conn.cursor() as cur:
        for sentiment in sorted(VALID_SENTIMENTS):
            cur.execute(
                "SELECT id, sentiment FROM messages "
                "WHERE sentiment_status = 'completed' AND sentiment = %s "
                "ORDER BY random() LIMIT %s",
                (sentiment, sample_size_per_class),
            )
            rows = cur.fetchall()
            sampled_by_class[sentiment] = [{"message_id": r[0], "sentiment_ai": r[1]} for r in rows]
            if len(rows) < sample_size_per_class:
                under_represented.append(sentiment)

        cur.execute(
            "INSERT INTO sentiment_validation_runs (created_at, sample_size_per_class, status) "
            "VALUES (%s, %s, 'sampled') RETURNING id",
            (datetime.now(timezone.utc), sample_size_per_class),
        )
        validation_run_id = cur.fetchone()[0]

        for entries in sampled_by_class.values():
            for entry in entries:
                cur.execute(
                    "INSERT INTO sentiment_validation_samples "
                    "(validation_run_id, message_id, sentiment_ai) VALUES (%s, %s, %s)",
                    (validation_run_id, entry["message_id"], entry["sentiment_ai"]),
                )
    conn.commit()

    return {
        "validation_run_id": validation_run_id,
        "sample_counts": {k: len(v) for k, v in sampled_by_class.items()},
        "under_represented": under_represented,
    }


def export_sample_rows(conn, validation_run_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT s.message_id, m.text, s.sentiment_ai "
            "FROM sentiment_validation_samples s "
            "JOIN messages m ON m.id = s.message_id "
            "WHERE s.validation_run_id = %s "
            "ORDER BY s.message_id",
            (validation_run_id,),
        )
        rows = cur.fetchall()
    return [
        {"id": message_id, "text": text, "sentiment_ai": sentiment_ai, "sentiment_manual": ""}
        for message_id, text, sentiment_ai in rows
    ]


def import_annotations(conn, validation_run_id: int, rows: list[dict]) -> dict:
    valid_count = 0
    match_count = 0
    invalid_ids: list[int] = []

    with conn.cursor() as cur:
        for row in rows:
            message_id = int(row["id"])
            annotation = (row.get("sentiment_manual") or "").strip()
            if annotation not in VALID_SENTIMENTS:
                invalid_ids.append(message_id)
                continue

            cur.execute(
                "UPDATE sentiment_validation_samples SET sentiment_manual = %s "
                "WHERE validation_run_id = %s AND message_id = %s "
                "RETURNING sentiment_ai",
                (annotation, validation_run_id, message_id),
            )
            result = cur.fetchone()
            if result is None:
                invalid_ids.append(message_id)
                continue

            valid_count += 1
            (sentiment_ai,) = result
            if sentiment_ai == annotation:
                match_count += 1

        agreement_rate = match_count / valid_count if valid_count else None
        cur.execute(
            "UPDATE sentiment_validation_runs SET status = 'annotated', agreement_rate = %s "
            "WHERE id = %s",
            (agreement_rate, validation_run_id),
        )
    conn.commit()

    return {
        "validation_run_id": validation_run_id,
        "valid_count": valid_count,
        "invalid_ids": invalid_ids,
        "agreement_rate": agreement_rate,
    }
