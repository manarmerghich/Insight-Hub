from app.validation_sample import draw_validation_sample, import_annotations


class FakeCursor:
    def __init__(self, fetchall_fn=None, fetchone_fn=None):
        self.executed = []
        self._fetchall_fn = fetchall_fn or (lambda query, params: [])
        self._fetchone_fn = fetchone_fn or (lambda query, params: None)
        self._last = ("", None)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, query, params=None):
        self.executed.append((query, params))
        self._last = (query, params)

    def fetchall(self):
        return self._fetchall_fn(*self._last)

    def fetchone(self):
        return self._fetchone_fn(*self._last)


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_obj = cursor
        self.committed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


class TestDrawValidationSample:
    def test_tirage_equilibre_par_classe(self):
        rows_by_sentiment = {
            "positif": [(1, "positif"), (2, "positif")],
            "négatif": [(3, "négatif"), (4, "négatif")],
            "neutre": [(5, "neutre"), (6, "neutre")],
        }

        def fetchall_fn(query, params):
            if "FROM messages" in query:
                return rows_by_sentiment[params[0]]
            return []

        def fetchone_fn(query, params):
            if "INSERT INTO sentiment_validation_runs" in query:
                return (42,)
            return None

        conn = FakeConnection(FakeCursor(fetchall_fn, fetchone_fn))

        result = draw_validation_sample(conn, sample_size_per_class=2)

        assert result["validation_run_id"] == 42
        assert result["sample_counts"] == {"positif": 2, "négatif": 2, "neutre": 2}
        assert result["under_represented"] == []
        sample_inserts = [
            (q, p)
            for q, p in conn.cursor_obj.executed
            if "INSERT INTO sentiment_validation_samples" in q
        ]
        assert len(sample_inserts) == 6
        assert all(p[0] == 42 for _, p in sample_inserts)
        assert conn.committed is True

    def test_classe_sous_representee_ne_bloque_pas_le_tirage(self):
        rows_by_sentiment = {
            "positif": [(1, "positif")],
            "négatif": [],
            "neutre": [(2, "neutre"), (3, "neutre")],
        }

        def fetchall_fn(query, params):
            if "FROM messages" in query:
                return rows_by_sentiment[params[0]]
            return []

        def fetchone_fn(query, params):
            if "INSERT INTO sentiment_validation_runs" in query:
                return (1,)
            return None

        conn = FakeConnection(FakeCursor(fetchall_fn, fetchone_fn))

        result = draw_validation_sample(conn, sample_size_per_class=2)

        assert result["sample_counts"] == {"positif": 1, "négatif": 0, "neutre": 2}
        assert set(result["under_represented"]) == {"positif", "négatif"}


class TestImportAnnotations:
    def test_rejet_annotation_invalide_sans_bloquer_les_autres(self):
        def fetchone_fn(query, params):
            if "RETURNING sentiment_ai" in query:
                return ("positif",)
            return None

        conn = FakeConnection(FakeCursor(fetchone_fn=fetchone_fn))
        rows = [
            {"id": "1", "sentiment_manual": "positif"},
            {"id": "2", "sentiment_manual": "bof"},
            {"id": "3", "sentiment_manual": ""},
        ]

        result = import_annotations(conn, validation_run_id=7, rows=rows)

        assert result["valid_count"] == 1
        assert result["invalid_ids"] == [2, 3]
        assert result["agreement_rate"] == 1.0
        update_calls = [
            (q, p) for q, p in conn.cursor_obj.executed if "RETURNING sentiment_ai" in q
        ]
        assert len(update_calls) == 1

    def test_taux_accord_sous_80_pourcent_sans_blocage(self):
        sentiment_ai_by_message_id = {1: "positif", 2: "positif", 3: "négatif", 4: "neutre", 5: "positif"}

        def fetchone_fn(query, params):
            if "RETURNING sentiment_ai" in query:
                message_id = params[2]
                return (sentiment_ai_by_message_id[message_id],)
            return None

        conn = FakeConnection(FakeCursor(fetchone_fn=fetchone_fn))
        # 2 match (id 1, id 4), 3 mismatch (id 2, 3, 5) -> agreement rate 2/5 = 0.4
        rows = [
            {"id": "1", "sentiment_manual": "positif"},
            {"id": "2", "sentiment_manual": "négatif"},
            {"id": "3", "sentiment_manual": "positif"},
            {"id": "4", "sentiment_manual": "neutre"},
            {"id": "5", "sentiment_manual": "neutre"},
        ]

        result = import_annotations(conn, validation_run_id=7, rows=rows)

        assert result["valid_count"] == 5
        assert result["agreement_rate"] == 0.4
        status_updates = [
            (q, p)
            for q, p in conn.cursor_obj.executed
            if "sentiment_validation_runs SET status = 'annotated'" in q
        ]
        assert len(status_updates) == 1
        assert status_updates[0][1] == (0.4, 7)
        assert conn.committed is True
