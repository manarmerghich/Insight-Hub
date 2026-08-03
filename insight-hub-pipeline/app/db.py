import os
from datetime import datetime, timezone

import psycopg


def get_connection() -> psycopg.Connection:
    return psycopg.connect(os.environ["DATABASE_URL"])


def create_import_run(conn: psycopg.Connection, *, keyword: str, source_filename: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO import_runs (keyword, source_filename, status, started_at) "
            "VALUES (%s, %s, 'running', %s) RETURNING id",
            (keyword, source_filename, datetime.now(timezone.utc)),
        )
        run_id = cur.fetchone()[0]
    conn.commit()
    return run_id


def update_run_status(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    *,
    matched_count: int | None = None,
    retained_count: int | None = None,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE import_runs SET status = %s, matched_count = %s, retained_count = %s, "
            "error_message = %s, finished_at = %s WHERE id = %s",
            (
                status,
                matched_count,
                retained_count,
                error_message,
                datetime.now(timezone.utc),
                run_id,
            ),
        )
    conn.commit()


def create_sentiment_run(conn: psycopg.Connection) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sentiment_runs (status, started_at) VALUES ('running', %s) RETURNING id",
            (datetime.now(timezone.utc),),
        )
        run_id = cur.fetchone()[0]
    conn.commit()
    return run_id


def finalize_sentiment_run(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    *,
    processed_count: int,
    error_count: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sentiment_runs SET status = %s, processed_count = %s, error_count = %s, "
            "finished_at = %s WHERE id = %s",
            (status, processed_count, error_count, datetime.now(timezone.utc), run_id),
        )
    conn.commit()


def create_theme_run(conn: psycopg.Connection) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO theme_runs (status, started_at) VALUES ('running', %s) RETURNING id",
            (datetime.now(timezone.utc),),
        )
        run_id = cur.fetchone()[0]
    conn.commit()
    return run_id


def finalize_theme_run(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    *,
    processed_count: int,
    error_count: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE theme_runs SET status = %s, processed_count = %s, error_count = %s, "
            "finished_at = %s WHERE id = %s",
            (status, processed_count, error_count, datetime.now(timezone.utc), run_id),
        )
    conn.commit()
