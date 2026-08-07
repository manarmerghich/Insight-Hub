from datetime import datetime

from app.dedup import INSERT_COLUMNS, dedup_key, insert_messages


def make_row(**overrides):
    row = {
        "text": "Enjoying a beautiful day at the park!",
        "sentiment_original": "Positive",
        "timestamp": datetime(2023, 1, 15, 12, 30, 0),
        "user": "User123",
        "platform": "Twitter",
        "hashtags": "#Nature #Park",
        "retweets": 15,
        "likes": 30,
        "country": "USA",
    }
    row.update(overrides)
    return row


class TestDedupKey:
    def test_identical_rows_produce_the_same_key(self):
        assert dedup_key(make_row(), "visitor-1") == dedup_key(make_row(), "visitor-1")

    def test_different_platform_changes_key(self):
        assert dedup_key(make_row(), "visitor-1") != dedup_key(
            make_row(platform="Instagram"), "visitor-1"
        )

    def test_different_user_changes_key(self):
        assert dedup_key(make_row(), "visitor-1") != dedup_key(
            make_row(user="OtherUser"), "visitor-1"
        )

    def test_different_text_changes_key(self):
        assert dedup_key(make_row(), "visitor-1") != dedup_key(
            make_row(text="Different text"), "visitor-1"
        )

    def test_different_timestamp_changes_key(self):
        other = make_row(timestamp=datetime(2023, 1, 16, 12, 30, 0))
        assert dedup_key(make_row(), "visitor-1") != dedup_key(other, "visitor-1")

    def test_key_is_independent_of_non_dedup_fields(self):
        # likes/retweets/hashtags/country/sentiment must not affect the dedup key
        other = make_row(likes=999, retweets=999, hashtags="#Other", country="France")
        assert dedup_key(make_row(), "visitor-1") == dedup_key(other, "visitor-1")

    def test_different_visitor_changes_key(self):
        # Cœur du correctif add-visitor-session-scoping : un même contenu
        # importé par deux visiteurs différents ne doit jamais partager la
        # même clé de déduplication.
        assert dedup_key(make_row(), "visitor-1") != dedup_key(make_row(), "visitor-2")


class FakeCursor:
    def __init__(self, return_rows):
        self.executed_query = None
        self.executed_params = None
        self._return_rows = return_rows

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, query, params):
        self.executed_query = query
        self.executed_params = params

    def fetchall(self):
        return self._return_rows


class FakeConnection:
    def __init__(self, return_rows):
        self.committed = False
        self._cursor = FakeCursor(return_rows)

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True


class TestInsertMessages:
    def test_empty_rows_returns_zero_without_touching_connection(self):
        assert (
            insert_messages(
                None, run_id=1, source_filename="f.csv", keyword="day", visitor_id="visitor-1", rows=[]
            )
            == 0
        )

    def test_returns_count_of_rows_actually_inserted(self):
        # Simulates Postgres skipping one row via ON CONFLICT DO NOTHING:
        # 2 rows submitted, only 1 id comes back from RETURNING.
        conn = FakeConnection(return_rows=[(1,)])
        rows = [make_row(), make_row(user="OtherUser")]

        count = insert_messages(
            conn, run_id=7, source_filename="f.csv", keyword="day", visitor_id="visitor-1", rows=rows
        )

        assert count == 1
        assert conn.committed is True

    def test_params_are_flattened_in_insert_columns_order(self):
        conn = FakeConnection(return_rows=[(1,), (2,)])
        rows = [make_row(), make_row(user="OtherUser")]

        insert_messages(
            conn, run_id=7, source_filename="f.csv", keyword="day", visitor_id="visitor-1", rows=rows
        )

        params = conn._cursor.executed_params
        assert len(params) == len(INSERT_COLUMNS) * len(rows)

        first_row_params = params[: len(INSERT_COLUMNS)]
        run_id_idx = INSERT_COLUMNS.index("run_id")
        visitor_id_idx = INSERT_COLUMNS.index("visitor_id")
        source_idx = INSERT_COLUMNS.index("source")
        text_idx = INSERT_COLUMNS.index("text")
        user_idx = INSERT_COLUMNS.index("user")
        keyword_idx = INSERT_COLUMNS.index("keyword")

        assert first_row_params[run_id_idx] == 7
        assert first_row_params[visitor_id_idx] == "visitor-1"
        assert first_row_params[source_idx] == "f.csv"
        assert first_row_params[text_idx] == "Enjoying a beautiful day at the park!"
        assert first_row_params[user_idx] == "User123"
        assert first_row_params[keyword_idx] == "day"

        second_row_params = params[len(INSERT_COLUMNS) :]
        assert second_row_params[user_idx] == "OtherUser"
