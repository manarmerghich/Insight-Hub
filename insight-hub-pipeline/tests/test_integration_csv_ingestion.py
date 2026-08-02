import csv
from pathlib import Path

import pytest

from app.db import create_import_run, update_run_status
from app.dedup import insert_messages
from app.filtering import matches_keyword
from app.normalize import normalize_row
from tests.conftest import requires_docker

REFERENCE_CSV_PATH = Path(__file__).resolve().parents[2] / "social-media-sentiments_analysis.csv"


def _load_reference_rows() -> list[dict]:
    with REFERENCE_CSV_PATH.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


@requires_docker
@pytest.mark.integration
class TestCsvIngestionIntegration:
    def test_replays_full_reference_csv_against_real_database(self, db_conn):
        raw_rows = _load_reference_rows()
        assert len(raw_rows) == 732

        keyword = "day"
        normalized = [normalize_row(r) for r in raw_rows]

        # No parasitic whitespace should survive normalization.
        assert not any(
            isinstance(value, str) and (value != value.strip() or "  " in value)
            for row in normalized
            for value in row.values()
            if isinstance(value, str)
        )

        filtered = [n for n in normalized if matches_keyword(n["text"], keyword)]
        assert len(filtered) == 46

        run_id = create_import_run(
            db_conn, keyword=keyword, source_filename="social-media-sentiments_analysis.csv"
        )
        with db_conn.cursor() as cur:
            cur.execute("SELECT status, finished_at FROM import_runs WHERE id = %s", (run_id,))
            status, finished_at = cur.fetchone()
        assert status == "running"
        assert finished_at is None

        inserted = insert_messages(
            db_conn, run_id, "social-media-sentiments_analysis.csv", keyword, filtered
        )
        assert inserted == 46
        update_run_status(
            db_conn, run_id, "completed", matched_count=len(filtered), retained_count=inserted
        )

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT status, matched_count, retained_count FROM import_runs WHERE id = %s",
                (run_id,),
            )
            status, matched_count, retained_count = cur.fetchone()
            cur.execute(
                "SELECT count(*), count(DISTINCT (platform, \"user\", text, timestamp)) "
                "FROM messages"
            )
            total, distinct_keys = cur.fetchone()
            cur.execute("SELECT count(*) FROM messages WHERE text != btrim(text) OR text LIKE '%  %'")
            (whitespace_violations,) = cur.fetchone()

        assert status == "completed"
        assert matched_count == 46
        assert retained_count == 46
        assert total == 46
        assert distinct_keys == 46
        assert whitespace_violations == 0

    def test_rerunning_the_same_import_inserts_no_new_rows_but_keeps_matched_count(self, db_conn):
        # Regression test: retained_count=0 must be distinguishable from "no keyword
        # match" — matched_count stays 46 (pre-dedup) even though nothing new is inserted.
        raw_rows = _load_reference_rows()
        keyword = "day"
        filtered = [
            normalize_row(r) for r in raw_rows if matches_keyword(normalize_row(r)["text"], keyword)
        ]

        run_id_1 = create_import_run(
            db_conn, keyword=keyword, source_filename="social-media-sentiments_analysis.csv"
        )
        first_inserted = insert_messages(
            db_conn, run_id_1, "social-media-sentiments_analysis.csv", keyword, filtered
        )
        assert first_inserted == 46
        update_run_status(
            db_conn,
            run_id_1,
            "completed",
            matched_count=len(filtered),
            retained_count=first_inserted,
        )

        run_id_2 = create_import_run(
            db_conn, keyword=keyword, source_filename="social-media-sentiments_analysis.csv"
        )
        second_inserted = insert_messages(
            db_conn, run_id_2, "social-media-sentiments_analysis.csv", keyword, filtered
        )
        assert second_inserted == 0
        update_run_status(
            db_conn,
            run_id_2,
            "completed",
            matched_count=len(filtered),
            retained_count=second_inserted,
        )

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT matched_count, retained_count FROM import_runs WHERE id = %s", (run_id_2,)
            )
            matched_count, retained_count = cur.fetchone()

        assert matched_count == 46
        assert retained_count == 0

    def test_intra_file_duplicate_is_collapsed_on_a_single_insert(self, db_conn):
        raw_rows = _load_reference_rows()
        keyword = "day"
        filtered = [
            normalize_row(r) for r in raw_rows if matches_keyword(normalize_row(r)["text"], keyword)
        ]
        rows_with_intra_file_dupe = filtered + [filtered[0]]

        run_id = create_import_run(
            db_conn, keyword=keyword, source_filename="social-media-sentiments_analysis.csv"
        )
        inserted = insert_messages(
            db_conn, run_id, "social-media-sentiments_analysis.csv", keyword, rows_with_intra_file_dupe
        )

        assert inserted == 46

    def test_run_status_reflects_failure(self, db_conn):
        run_id = create_import_run(db_conn, keyword="x", source_filename="broken.csv")
        update_run_status(db_conn, run_id, "error", error_message="unreadable CSV file: bad encoding")

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT status, error_message, finished_at FROM import_runs WHERE id = %s", (run_id,)
            )
            status, error_message, finished_at = cur.fetchone()

        assert status == "error"
        assert error_message == "unreadable CSV file: bad encoding"
        assert finished_at is not None
