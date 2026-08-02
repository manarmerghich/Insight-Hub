from app.filtering import matches_keyword


class TestMatchesKeyword:
    def test_exact_case_match(self):
        assert matches_keyword("Traffic was terrible this morning.", "Traffic") is True

    def test_case_insensitive_match(self):
        assert matches_keyword("Traffic was terrible this morning.", "traffic") is True
        assert matches_keyword("traffic was terrible this morning.", "TRAFFIC") is True

    def test_substring_match_within_word_boundary(self):
        assert matches_keyword("Enjoying a beautiful day at the park!", "day") is True

    def test_no_match_returns_false(self):
        assert matches_keyword("Enjoying a beautiful day at the park!", "traffic") is False

    def test_empty_keyword_returns_false(self):
        assert matches_keyword("Some text", "") is False

    def test_none_keyword_returns_false(self):
        assert matches_keyword("Some text", None) is False

    def test_match_at_start_and_end_of_text(self):
        assert matches_keyword("Nature is beautiful", "Nature") is True
        assert matches_keyword("Nature is beautiful", "beautiful") is True

    def test_empty_text_returns_false(self):
        assert matches_keyword("", "keyword") is False
