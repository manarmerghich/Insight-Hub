import asyncio
import json

import pytest

from app.db import create_import_run
from app.themes import MIN_THEMES
from app.workflows import run_import_pipeline
from tests.conftest import requires_docker

DISCOVERED_THEMES = [
    {"label": f"Theme {i}", "description": f"Description {i}"} for i in range(MIN_THEMES)
]


class FakeModels:
    def __init__(self):
        self.call_count = 0

    def generate_content(self, **kwargs):
        self.call_count += 1
        prompt = kwargs["contents"]
        ids = [int(line.split("id ")[1].split(":")[0]) for line in prompt.splitlines() if "- id" in line]
        results = [{"id": i, "sentiment": "positif"} for i in ids]

        class Response:
            text = json.dumps({"results": results})

        return Response()


class FakeClient:
    def __init__(self):
        self.models = FakeModels()


class FakeThemeModels:
    def __init__(self):
        self.call_count = 0
        self.discovery_call_count = 0

    def generate_content(self, **kwargs):
        self.call_count += 1
        contents = kwargs["contents"]

        class Response:
            text = None

        if "- id " not in contents:
            self.discovery_call_count += 1
            Response.text = json.dumps({"themes": DISCOVERED_THEMES})
            return Response()

        ids = [
            int(line.split("id ")[1].split(":")[0]) for line in contents.splitlines() if "- id" in line
        ]
        results = [{"id": i, "theme": "Theme 0"} for i in ids]
        Response.text = json.dumps({"results": results})
        return Response()


class FakeThemeClient:
    def __init__(self):
        self.models = FakeThemeModels()


def _raw_row(text: str) -> dict:
    return {
        "Text": text,
        "Sentiment": "joy",
        "Timestamp": "2024-01-01 10:00:00",
        "User": "user1",
        "Platform": "Twitter",
        "Hashtags": "",
        "Retweets": "1",
        "Likes": "2",
        "Country": "USA",
    }


@requires_docker
@pytest.mark.integration
class TestImportPipelineAutoTriggersSentimentClassification:
    def test_successful_import_with_new_messages_triggers_classification(
        self, db_conn, postgres_dsn, monkeypatch
    ):
        monkeypatch.setenv("DATABASE_URL", postgres_dsn)
        run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv", visitor_id="test-visitor")

        client = FakeClient()
        theme_client = FakeThemeClient()
        result = asyncio.run(
            run_import_pipeline(
                run_id=run_id,
                keyword="day",
                visitor_id="test-visitor",
                source_filename="test.csv",
                rows=[_raw_row("What a beautiful day")],
                sentiment_client=client,
                theme_client=theme_client,
            )
        )

        assert result["status"] == "completed"
        assert result["inserted_count"] == 1
        assert client.models.call_count == 1
        assert result["sentiment_classification"]["status"] == "completed"
        assert result["sentiment_classification"]["processed_count"] == 1
        assert result["theme_classification"]["status"] == "completed"
        assert result["theme_classification"]["processed_count"] == 1

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT sentiment, sentiment_status FROM messages WHERE run_id = %s", (run_id,)
            )
            rows = cur.fetchall()
        assert rows == [("positif", "completed")]

    def test_import_with_no_new_messages_does_not_trigger_classification(
        self, db_conn, postgres_dsn, monkeypatch
    ):
        monkeypatch.setenv("DATABASE_URL", postgres_dsn)
        raw_row = _raw_row("Already imported day message")

        first_run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv", visitor_id="test-visitor")
        asyncio.run(
            run_import_pipeline(
                run_id=first_run_id,
                keyword="day",
                visitor_id="test-visitor",
                source_filename="test.csv",
                rows=[raw_row],
                sentiment_client=FakeClient(),
            )
        )

        second_run_id = create_import_run(db_conn, keyword="day", source_filename="test.csv", visitor_id="test-visitor")
        client = FakeClient()
        theme_client = FakeThemeClient()
        result = asyncio.run(
            run_import_pipeline(
                run_id=second_run_id,
                keyword="day",
                visitor_id="test-visitor",
                source_filename="test.csv",
                rows=[raw_row],
                sentiment_client=client,
                theme_client=theme_client,
            )
        )

        assert result["status"] == "completed"
        assert result["inserted_count"] == 0
        assert "sentiment_classification" not in result
        assert "theme_classification" not in result
        assert client.models.call_count == 0
        assert theme_client.models.call_count == 0
