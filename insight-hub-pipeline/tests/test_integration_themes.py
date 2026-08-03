from datetime import datetime, timezone

import pytest

from app.db import create_import_run
from app.themes import MIN_THEMES, run_theme_classification
from tests.conftest import requires_docker

DISCOVERED_THEMES = [
    {"label": f"Theme {i}", "description": f"Description {i}"} for i in range(MIN_THEMES)
]


def _insert_message(conn, *, run_id: int, text: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO messages (run_id, source, text, timestamp, \"user\", platform, keyword) "
            "VALUES (%s, 'test.csv', %s, %s, 'user1', 'Twitter', 'day') RETURNING id",
            (run_id, text, datetime.now(timezone.utc)),
        )
        message_id = cur.fetchone()[0]
    conn.commit()
    return message_id


class FakeToolUseBlock:
    type = "tool_use"

    def __init__(self, input_data):
        self.input = input_data


class FakeMessages:
    def __init__(self, theme_by_id):
        self._theme_by_id = theme_by_id
        self.call_count = 0
        self.discovery_call_count = 0

    def create(self, **kwargs):
        self.call_count += 1

        class Response:
            content = None

        if kwargs["tool_choice"]["name"] == "discover_themes":
            self.discovery_call_count += 1
            Response.content = [FakeToolUseBlock({"themes": DISCOVERED_THEMES})]
            return Response()

        prompt = kwargs["messages"][0]["content"]
        ids = [
            int(line.split("id ")[1].split(":")[0]) for line in prompt.splitlines() if "- id" in line
        ]
        results = [{"id": i, "theme": self._theme_by_id[i]} for i in ids]
        Response.content = [FakeToolUseBlock({"results": results})]
        return Response()


class FakeClient:
    def __init__(self, theme_by_id):
        self.messages = FakeMessages(theme_by_id)


@requires_docker
@pytest.mark.integration
class TestThemeClassificationIntegration:
    def test_bootstrap_discovery_on_empty_database_then_classifies_pending_messages(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv")
        message_ids = [
            _insert_message(db_conn, run_id=run_id, text="What a beautiful day"),
            _insert_message(db_conn, run_id=run_id, text="Worst day ever"),
        ]

        client = FakeClient({message_ids[0]: "Theme 0", message_ids[1]: "Theme 1"})
        result = run_theme_classification(db_conn, client=client)

        assert result == {"processed_count": 2, "error_count": 0}
        assert client.messages.discovery_call_count == 1

        with db_conn.cursor() as cur:
            cur.execute("SELECT label FROM themes ORDER BY id")
            labels = [row[0] for row in cur.fetchall()]
        assert labels == [theme["label"] for theme in DISCOVERED_THEMES]

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT theme_status FROM messages WHERE id = ANY(%s) ORDER BY id",
                (message_ids,),
            )
            rows = cur.fetchall()
        assert rows == [("completed",), ("completed",)]

    def test_resuming_across_two_invocations_does_not_double_count_or_rediscover(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv")
        message_ids = [
            _insert_message(db_conn, run_id=run_id, text="What a beautiful day"),
            _insert_message(db_conn, run_id=run_id, text="Worst day ever"),
        ]

        client = FakeClient({message_ids[0]: "Theme 0", message_ids[1]: "Theme 1"})
        first_result = run_theme_classification(db_conn, client=client)

        assert first_result == {"processed_count": 2, "error_count": 0}
        assert client.messages.call_count == 2  # discovery + one classification batch

        second_result = run_theme_classification(db_conn, client=client)

        # Both messages are already `completed` and the theme referential
        # already exists — the second invocation must not resubmit messages
        # or re-run discovery.
        assert second_result == {"processed_count": 0, "error_count": 0}
        assert client.messages.discovery_call_count == 1
        assert client.messages.call_count == 2

    def test_discovery_failure_leaves_messages_pending_for_a_later_invocation(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv")
        message_id = _insert_message(db_conn, run_id=run_id, text="What a beautiful day")

        class FailingMessages:
            def create(self, **kwargs):
                raise RuntimeError("discovery failed")

        class FailingClient:
            messages = FailingMessages()

        result = run_theme_classification(db_conn, client=FailingClient())

        assert result == {"processed_count": 0, "error_count": 0}

        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM themes")
            (theme_count,) = cur.fetchone()
        assert theme_count == 0

        with db_conn.cursor() as cur:
            cur.execute("SELECT theme_status FROM messages WHERE id = %s", (message_id,))
            (status,) = cur.fetchone()
        assert status == "pending"
