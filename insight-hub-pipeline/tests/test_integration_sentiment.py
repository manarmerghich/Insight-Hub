import json
from datetime import datetime, timezone

import pytest

from app.db import create_import_run
from app.sentiment import run_classification
from tests.conftest import requires_docker


def _insert_message(conn, *, run_id: int, text: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO messages (run_id, visitor_id, source, text, timestamp, \"user\", platform, keyword) "
            "VALUES (%s, 'test-visitor', 'test.csv', %s, %s, 'user1', 'Twitter', 'day') RETURNING id",
            (run_id, text, datetime.now(timezone.utc)),
        )
        message_id = cur.fetchone()[0]
    conn.commit()
    return message_id


class FakeModels:
    def __init__(self, sentiment_by_id):
        self._sentiment_by_id = sentiment_by_id
        self.call_count = 0

    def generate_content(self, **kwargs):
        self.call_count += 1
        prompt = kwargs["contents"]
        ids = [int(line.split("id ")[1].split(":")[0]) for line in prompt.splitlines() if "- id" in line]
        results = [{"id": i, "sentiment": self._sentiment_by_id[i]} for i in ids]

        class Response:
            text = json.dumps({"results": results})

        return Response()


class FakeClient:
    def __init__(self, sentiment_by_id):
        self.models = FakeModels(sentiment_by_id)


@requires_docker
@pytest.mark.integration
class TestSentimentClassificationIntegration:
    def test_resuming_across_two_invocations_does_not_double_count(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv", visitor_id="test-visitor")
        message_ids = [
            _insert_message(db_conn, run_id=run_id, text="What a beautiful day"),
            _insert_message(db_conn, run_id=run_id, text="Worst day ever"),
        ]

        client = FakeClient({message_ids[0]: "positif", message_ids[1]: "négatif"})
        first_result = run_classification(db_conn, client=client)

        assert first_result == {"processed_count": 2, "error_count": 0}
        assert client.models.call_count == 1

        second_result = run_classification(db_conn, client=client)

        # Both messages are already `completed` — the second invocation must not
        # resubmit them, so no additional API call and no further processed count.
        assert second_result == {"processed_count": 0, "error_count": 0}
        assert client.models.call_count == 1

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT sentiment, sentiment_status FROM messages WHERE id = ANY(%s) ORDER BY id",
                (message_ids,),
            )
            rows = cur.fetchall()
        assert rows == [("positif", "completed"), ("négatif", "completed")]

    def test_sentiment_original_untouched_after_reclassification(self, db_conn):
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv", visitor_id="test-visitor")
        with db_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO messages (run_id, visitor_id, source, text, sentiment_original, timestamp, "
                '"user", platform, keyword) '
                "VALUES (%s, 'test-visitor', 'test.csv', 'What a day', 'joy', %s, 'user1', 'Twitter', 'day') "
                "RETURNING id",
                (run_id, datetime.now(timezone.utc)),
            )
            message_id = cur.fetchone()[0]
        db_conn.commit()

        client = FakeClient({message_id: "positif"})
        run_classification(db_conn, client=client)

        with db_conn.cursor() as cur:
            cur.execute("SELECT sentiment_original FROM messages WHERE id = %s", (message_id,))
            (sentiment_original,) = cur.fetchone()
        assert sentiment_original == "joy"
