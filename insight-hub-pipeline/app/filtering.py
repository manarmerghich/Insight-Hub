def matches_keyword(text: str, keyword: str) -> bool:
    if not keyword:
        return False
    return keyword.lower() in text.lower()
