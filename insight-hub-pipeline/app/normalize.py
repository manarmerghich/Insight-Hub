from datetime import datetime

from dateutil import parser as date_parser


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(value.split())


def parse_timestamp(value: str) -> datetime:
    cleaned = normalize_text(value)
    try:
        return datetime.strptime(cleaned, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return date_parser.parse(cleaned)


def parse_int(value: str | None) -> int | None:
    cleaned = normalize_text(value)
    if not cleaned:
        return None
    return int(float(cleaned))


def normalize_row(raw: dict) -> dict:
    return {
        "text": normalize_text(raw.get("Text")),
        "sentiment_original": normalize_text(raw.get("Sentiment")) or None,
        "timestamp": parse_timestamp(raw.get("Timestamp", "")),
        "user": normalize_text(raw.get("User")),
        "platform": normalize_text(raw.get("Platform")),
        "hashtags": normalize_text(raw.get("Hashtags")) or None,
        "retweets": parse_int(raw.get("Retweets")),
        "likes": parse_int(raw.get("Likes")),
        "country": normalize_text(raw.get("Country")) or None,
    }
