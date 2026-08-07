from datetime import datetime, timezone

from psycopg import sql

# Order matters: mirrors the messages table column list in schema.ts.
INSERT_COLUMNS = (
    "run_id",
    "visitor_id",
    "source",
    "collected_at",
    "text",
    "sentiment_original",
    "timestamp",
    "user",
    "platform",
    "hashtags",
    "retweets",
    "likes",
    "country",
    "keyword",
)


def dedup_key(row: dict, visitor_id: str) -> tuple:
    # Scopé par visiteur (voir add-visitor-session-scoping) : deux visiteurs
    # qui importent un contenu identique ne se dédupliquent jamais entre eux.
    return (visitor_id, row["platform"], row["user"], row["text"], row["timestamp"])


def insert_messages(
    conn, run_id: int, source_filename: str, keyword: str, visitor_id: str, rows: list[dict]
) -> int:
    if not rows:
        return 0

    collected_at = datetime.now(timezone.utc)
    query = sql.SQL(
        "INSERT INTO messages ({fields}) VALUES {values} "
        'ON CONFLICT (visitor_id, platform, "user", text, timestamp) DO NOTHING '
        "RETURNING id"
    ).format(
        fields=sql.SQL(", ").join(sql.Identifier(c) for c in INSERT_COLUMNS),
        values=sql.SQL(", ").join(
            sql.SQL("({})").format(sql.SQL(", ").join(sql.Placeholder() for _ in INSERT_COLUMNS))
            for _ in rows
        ),
    )

    params: list = []
    for row in rows:
        params.extend(
            [
                run_id,
                visitor_id,
                source_filename,
                collected_at,
                row["text"],
                row["sentiment_original"],
                row["timestamp"],
                row["user"],
                row["platform"],
                row["hashtags"],
                row["retweets"],
                row["likes"],
                row["country"],
                keyword,
            ]
        )

    with conn.cursor() as cur:
        cur.execute(query, params)
        inserted = cur.fetchall()
    conn.commit()
    return len(inserted)
