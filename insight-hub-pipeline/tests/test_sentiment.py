import json

from app.sentiment import classify_batch, fetch_pending_messages, write_batch_results


class FakeCursor:
    def __init__(self, fetchall_rows=None):
        self.fetchall_rows = fetchall_rows or []
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchall(self):
        return self.fetchall_rows


class FakeConnection:
    def __init__(self, fetchall_rows=None):
        self.committed = False
        self.cursor_obj = FakeCursor(fetchall_rows)

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


class FakeResponse:
    def __init__(self, payload):
        self.text = json.dumps(payload)


class FakeModels:
    def __init__(self, response):
        self._response = response
        self.generate_content_calls = []

    def generate_content(self, **kwargs):
        self.generate_content_calls.append(kwargs)
        return self._response


class FakeClient:
    def __init__(self, response):
        self.models = FakeModels(response)


class TestFetchPendingMessages:
    def test_selects_only_pending_and_error_messages(self):
        conn = FakeConnection(fetchall_rows=[(1, "great day"), (2, "terrible day")])

        result = fetch_pending_messages(conn, limit=25)

        query, params = conn.cursor_obj.executed[0]
        assert "sentiment_status IN ('pending', 'error')" in query
        assert params == (25,)
        assert result == [{"id": 1, "text": "great day"}, {"id": 2, "text": "terrible day"}]


class TestClassifyBatch:
    def test_returns_id_to_sentiment_mapping(self):
        response = FakeResponse({"results": [{"id": 1, "sentiment": "positif"}]})
        client = FakeClient(response)

        results = classify_batch(client, "gemini-2.5-flash-lite", [{"id": 1, "text": "great day"}])

        assert results == {1: "positif"}

    def test_ignores_entries_with_an_invalid_sentiment_value(self):
        response = FakeResponse(
            {"results": [{"id": 1, "sentiment": "positif"}, {"id": 2, "sentiment": "bof"}]}
        )
        client = FakeClient(response)

        results = classify_batch(
            client, "gemini-2.5-flash-lite", [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]
        )

        assert results == {1: "positif"}


class TestWriteBatchResults:
    def test_message_deja_classe_ecrit_sentiment_et_statut_completed(self):
        conn = FakeConnection()
        batch = [{"id": 1, "text": "great day"}]

        processed, errors = write_batch_results(conn, batch, {1: "positif"})

        assert processed == 1
        assert errors == 0
        query, params = conn.cursor_obj.executed[0]
        assert "sentiment_status = 'completed'" in query
        assert params == ("positif", 1)
        assert conn.committed is True

    def test_message_en_erreur_ne_bloque_pas_le_reste_du_lot(self):
        conn = FakeConnection()
        batch = [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]

        processed, errors = write_batch_results(conn, batch, {1: "positif"})

        assert processed == 1
        assert errors == 1
        second_query, second_params = conn.cursor_obj.executed[1]
        assert "sentiment_status = 'error'" in second_query
        assert second_params[1] == 2

    def test_never_touches_sentiment_original_column(self):
        conn = FakeConnection()
        batch = [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]

        write_batch_results(conn, batch, {1: "positif"})

        for query, _ in conn.cursor_obj.executed:
            assert "sentiment_original" not in query
