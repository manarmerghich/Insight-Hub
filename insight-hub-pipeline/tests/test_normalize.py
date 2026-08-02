from datetime import datetime

import pytest

from app.normalize import normalize_row, normalize_text, parse_int, parse_timestamp


class TestNormalizeText:
    def test_strips_leading_and_trailing_spaces(self):
        assert normalize_text("  hello world  ") == "hello world"

    def test_collapses_internal_multiple_spaces(self):
        assert normalize_text("hello    world") == "hello world"

    def test_leaves_already_clean_text_untouched(self):
        assert normalize_text("hello world") == "hello world"

    def test_none_returns_empty_string(self):
        assert normalize_text(None) == ""

    def test_empty_string_returns_empty_string(self):
        assert normalize_text("") == ""

    def test_whitespace_only_returns_empty_string(self):
        assert normalize_text("     ") == ""


class TestParseTimestamp:
    def test_parses_reference_csv_format(self):
        assert parse_timestamp("2023-01-15 12:30:00") == datetime(2023, 1, 15, 12, 30, 0)

    def test_parses_with_surrounding_whitespace(self):
        assert parse_timestamp("  2023-01-15 12:30:00  ") == datetime(2023, 1, 15, 12, 30, 0)

    def test_falls_back_to_flexible_parsing_for_other_formats(self):
        assert parse_timestamp("2023/01/15 12:30:00") == datetime(2023, 1, 15, 12, 30, 0)

    def test_invalid_timestamp_raises(self):
        with pytest.raises(ValueError):
            parse_timestamp("not a date")

    def test_empty_timestamp_raises(self):
        with pytest.raises(ValueError):
            parse_timestamp("")


class TestParseInt:
    def test_parses_float_string_as_int(self):
        assert parse_int("15.0") == 15

    def test_parses_plain_int_string(self):
        assert parse_int("42") == 42

    def test_none_returns_none(self):
        assert parse_int(None) is None

    def test_empty_string_returns_none(self):
        assert parse_int("") is None

    def test_whitespace_only_returns_none(self):
        assert parse_int("   ") is None


class TestNormalizeRow:
    def test_cleans_parasitic_whitespace_on_all_text_fields(self):
        raw = {
            "Text": "  Enjoying a beautiful day at the park!              ",
            "Sentiment": " Positive  ",
            "Timestamp": "2023-01-15 12:30:00",
            "User": " User123      ",
            "Platform": " Twitter  ",
            "Hashtags": " #Nature #Park                            ",
            "Retweets": "15.0",
            "Likes": "30.0",
            "Country": " USA      ",
        }
        row = normalize_row(raw)
        assert row == {
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

    def test_missing_optional_fields_become_none(self):
        raw = {
            "Text": "Some text",
            "Sentiment": "",
            "Timestamp": "2023-01-15 12:30:00",
            "User": "SomeUser",
            "Platform": "Twitter",
        }
        row = normalize_row(raw)
        assert row["sentiment_original"] is None
        assert row["hashtags"] is None
        assert row["retweets"] is None
        assert row["likes"] is None
        assert row["country"] is None
