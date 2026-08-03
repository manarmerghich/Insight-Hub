from datetime import datetime, timezone

import pytest

from app.db import create_import_run
from tests.conftest import requires_docker

# Mirrors the SQL that insight-hub-web's Drizzle theme-ranking query compiles
# to (left join on completed messages, group by theme, ordered desc) — there
# is no JS test runner configured in insight-hub-web, so the query's behavior
# is verified here against the same migrated schema.
RANKING_QUERY = """
    SELECT themes.label, COUNT(messages.id) AS message_count
    FROM themes
    LEFT JOIN messages
        ON messages.theme_id = themes.id AND messages.theme_status = 'completed'
    GROUP BY themes.id, themes.label
    ORDER BY COUNT(messages.id) DESC
"""


def _insert_theme(conn, *, label: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO themes (label, description) VALUES (%s, 'desc') RETURNING id",
            (label,),
        )
        theme_id = cur.fetchone()[0]
    conn.commit()
    return theme_id


def _insert_message(conn, *, run_id: int, theme_id: int, theme_status: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO messages (run_id, source, text, timestamp, \"user\", platform, keyword, "
            "theme_id, theme_status) "
            "VALUES (%s, 'test.csv', 'a message', %s, 'user1', 'Twitter', 'day', %s, %s)",
            (run_id, datetime.now(timezone.utc), theme_id, theme_status),
        )
    conn.commit()


@requires_docker
@pytest.mark.integration
class TestThemeRankingIntegration:
    def test_themes_without_completed_messages_appear_with_zero_count(self, db_conn):
        _insert_theme(db_conn, label="Support")
        _insert_theme(db_conn, label="Prix")

        with db_conn.cursor() as cur:
            cur.execute(RANKING_QUERY)
            rows = cur.fetchall()

        assert dict(rows) == {"Support": 0, "Prix": 0}

    def test_pending_and_error_messages_are_excluded_from_the_ranking(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv")
        support_id = _insert_theme(db_conn, label="Support")
        _insert_theme(db_conn, label="Prix")

        _insert_message(db_conn, run_id=run_id, theme_id=support_id, theme_status="completed")
        _insert_message(db_conn, run_id=run_id, theme_id=support_id, theme_status="pending")
        _insert_message(db_conn, run_id=run_id, theme_id=support_id, theme_status="error")

        with db_conn.cursor() as cur:
            cur.execute(RANKING_QUERY)
            rows = cur.fetchall()

        assert dict(rows) == {"Support": 1, "Prix": 0}

    def test_themes_are_ordered_by_message_count_descending(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv")
        support_id = _insert_theme(db_conn, label="Support")
        price_id = _insert_theme(db_conn, label="Prix")

        _insert_message(db_conn, run_id=run_id, theme_id=support_id, theme_status="completed")
        _insert_message(db_conn, run_id=run_id, theme_id=price_id, theme_status="completed")
        _insert_message(db_conn, run_id=run_id, theme_id=price_id, theme_status="completed")

        with db_conn.cursor() as cur:
            cur.execute(RANKING_QUERY)
            rows = cur.fetchall()

        assert rows == [("Prix", 2), ("Support", 1)]
