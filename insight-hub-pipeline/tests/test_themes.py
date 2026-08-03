from app.themes import (
    classify_theme_batch,
    discover_themes,
    fetch_discovery_sample,
    insert_themes,
    load_theme_labels,
    themes_exist,
    write_batch_results,
)


class FakeCursor:
    def __init__(self, fetchall_rows=None, fetchone_rows=None):
        self.fetchall_rows = fetchall_rows or []
        self.fetchone_rows = list(fetchone_rows or [])
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchall(self):
        return self.fetchall_rows

    def fetchone(self):
        return self.fetchone_rows.pop(0)


class FakeConnection:
    def __init__(self, fetchall_rows=None, fetchone_rows=None):
        self.committed = False
        self.cursor_obj = FakeCursor(fetchall_rows, fetchone_rows)

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


class FakeToolUseBlock:
    type = "tool_use"

    def __init__(self, input_data):
        self.input = input_data


class FakeResponse:
    def __init__(self, content):
        self.content = content


class FakeMessages:
    def __init__(self, response):
        self._response = response
        self.create_calls = []

    def create(self, **kwargs):
        self.create_calls.append(kwargs)
        return self._response


class FakeClient:
    def __init__(self, response):
        self.messages = FakeMessages(response)


class TestFetchDiscoverySample:
    def test_selects_a_random_sample_of_already_imported_messages(self):
        conn = FakeConnection(fetchall_rows=[(1, "a message"), (2, "another message")])

        result = fetch_discovery_sample(conn, limit=200)

        query, params = conn.cursor_obj.executed[0]
        assert "random()" in query
        assert params == (200,)
        assert result == [{"id": 1, "text": "a message"}, {"id": 2, "text": "another message"}]


class TestDiscoverThemes:
    def test_returns_exploitable_themes_within_bounds(self):
        themes = [{"label": f"Theme {i}", "description": f"Description {i}"} for i in range(5)]
        response = FakeResponse([FakeToolUseBlock({"themes": themes})])
        client = FakeClient(response)

        result = discover_themes(client, "claude-haiku-4-5", [{"id": 1, "text": "a"}])

        assert result == themes

    def test_raises_when_fewer_than_five_themes_are_exploitable(self):
        themes = [{"label": "Theme 1", "description": "Description 1"}]
        response = FakeResponse([FakeToolUseBlock({"themes": themes})])
        client = FakeClient(response)

        try:
            discover_themes(client, "claude-haiku-4-5", [{"id": 1, "text": "a"}])
            assert False, "expected ValueError"
        except ValueError:
            pass

    def test_raises_when_more_than_eight_themes_are_returned(self):
        themes = [{"label": f"Theme {i}", "description": f"Description {i}"} for i in range(9)]
        response = FakeResponse([FakeToolUseBlock({"themes": themes})])
        client = FakeClient(response)

        try:
            discover_themes(client, "claude-haiku-4-5", [{"id": 1, "text": "a"}])
            assert False, "expected ValueError"
        except ValueError:
            pass

    def test_discards_entries_with_a_blank_label_or_description(self):
        themes = [{"label": f"Theme {i}", "description": f"Description {i}"} for i in range(5)]
        themes.append({"label": "", "description": "orphan"})
        response = FakeResponse([FakeToolUseBlock({"themes": themes})])
        client = FakeClient(response)

        result = discover_themes(client, "claude-haiku-4-5", [{"id": 1, "text": "a"}])

        assert result == themes[:5]


class TestThemesExist:
    def test_returns_true_when_a_theme_row_exists(self):
        conn = FakeConnection(fetchone_rows=[(True,)])

        assert themes_exist(conn) is True

    def test_returns_false_when_no_theme_row_exists(self):
        conn = FakeConnection(fetchone_rows=[(False,)])

        assert themes_exist(conn) is False


class TestInsertThemes:
    def test_inserts_one_row_per_theme_and_commits(self):
        conn = FakeConnection()
        themes = [
            {"label": "Support", "description": "Demandes de support"},
            {"label": "Prix", "description": "Discussions sur le prix"},
        ]

        insert_themes(conn, themes)

        assert len(conn.cursor_obj.executed) == 2
        assert conn.committed is True


class TestLoadThemeLabels:
    def test_returns_label_to_id_mapping(self):
        conn = FakeConnection(fetchall_rows=[(1, "Support"), (2, "Prix")])

        result = load_theme_labels(conn)

        assert result == {"Support": 1, "Prix": 2}


class TestClassifyThemeBatch:
    def test_returns_id_to_theme_id_mapping(self):
        response = FakeResponse([FakeToolUseBlock({"results": [{"id": 1, "theme": "Support"}]})])
        client = FakeClient(response)

        results = classify_theme_batch(
            client, "claude-haiku-4-5", [{"id": 1, "text": "j'ai un souci"}], {"Support": 1, "Prix": 2}
        )

        assert results == {1: 1}

    def test_rejects_a_theme_label_outside_the_reference_set(self):
        response = FakeResponse(
            [FakeToolUseBlock({"results": [{"id": 1, "theme": "Support"}, {"id": 2, "theme": "Inconnu"}]})]
        )
        client = FakeClient(response)

        results = classify_theme_batch(
            client,
            "claude-haiku-4-5",
            [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}],
            {"Support": 1, "Prix": 2},
        )

        assert results == {1: 1}


class TestWriteBatchResults:
    def test_message_classe_ecrit_theme_id_et_statut_completed(self):
        conn = FakeConnection()
        batch = [{"id": 1, "text": "j'ai un souci"}]

        processed, errors = write_batch_results(conn, batch, {1: 1})

        assert processed == 1
        assert errors == 0
        query, params = conn.cursor_obj.executed[0]
        assert "theme_status = 'completed'" in query
        assert params == (1, 1)
        assert conn.committed is True

    def test_message_en_erreur_ne_bloque_pas_le_reste_du_lot(self):
        conn = FakeConnection()
        batch = [{"id": 1, "text": "a"}, {"id": 2, "text": "b"}]

        processed, errors = write_batch_results(conn, batch, {1: 1})

        assert processed == 1
        assert errors == 1
        second_query, second_params = conn.cursor_obj.executed[1]
        assert "theme_status = 'error'" in second_query
        assert second_params[1] == 2
