import os
import time

import anthropic

BATCH_SIZE = 25
TIME_BUDGET_SECONDS = 45
VALID_SENTIMENTS = {"positif", "négatif", "neutre"}

CLASSIFY_TOOL = {
    "name": "classify_sentiment",
    "description": "Enregistre le sentiment (positif, négatif ou neutre) de chaque message du lot.",
    "input_schema": {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "sentiment": {
                            "type": "string",
                            "enum": ["positif", "négatif", "neutre"],
                        },
                    },
                    "required": ["id", "sentiment"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["results"],
        "additionalProperties": False,
    },
    "strict": True,
}


def get_model() -> str:
    return os.environ.get("ANTHROPIC_SENTIMENT_MODEL", "claude-haiku-4-5")


def fetch_pending_messages(conn, *, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, text FROM messages WHERE sentiment_status IN ('pending', 'error') "
            "ORDER BY id LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [{"id": row[0], "text": row[1]} for row in rows]


def classify_batch(client: anthropic.Anthropic, model: str, batch: list[dict]) -> dict[int, str]:
    prompt_lines = "\n".join(f"- id {m['id']}: {m['text']}" for m in batch)
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        tools=[CLASSIFY_TOOL],
        tool_choice={"type": "tool", "name": "classify_sentiment"},
        messages=[
            {
                "role": "user",
                "content": (
                    "Classe chaque message ci-dessous en positif, négatif ou neutre, "
                    "d'après son contenu uniquement. Un résultat par identifiant.\n\n"
                    f"{prompt_lines}"
                ),
            }
        ],
    )
    tool_use = next(block for block in response.content if block.type == "tool_use")
    results: dict[int, str] = {}
    for entry in tool_use.input["results"]:
        if entry["sentiment"] in VALID_SENTIMENTS:
            results[entry["id"]] = entry["sentiment"]
    return results


def write_batch_results(conn, batch: list[dict], results: dict[int, str]) -> tuple[int, int]:
    processed = 0
    errors = 0
    with conn.cursor() as cur:
        for message in batch:
            sentiment = results.get(message["id"])
            if sentiment is not None:
                cur.execute(
                    "UPDATE messages SET sentiment = %s, sentiment_status = 'completed', "
                    "sentiment_error = NULL WHERE id = %s",
                    (sentiment, message["id"]),
                )
                processed += 1
            else:
                cur.execute(
                    "UPDATE messages SET sentiment_status = 'error', "
                    "sentiment_error = %s WHERE id = %s",
                    ("no classification returned for this message", message["id"]),
                )
                errors += 1
    conn.commit()
    return processed, errors


def run_classification(conn, *, deadline: float | None = None, client=None) -> dict:
    if deadline is None:
        deadline = time.monotonic() + TIME_BUDGET_SECONDS

    if client is None:
        client = anthropic.Anthropic()
    model = get_model()
    processed_count = 0
    error_count = 0

    while time.monotonic() < deadline:
        batch = fetch_pending_messages(conn, limit=BATCH_SIZE)
        if not batch:
            break

        try:
            results = classify_batch(client, model, batch)
        except Exception:
            results = {}

        processed, errors = write_batch_results(conn, batch, results)
        processed_count += processed
        error_count += errors

    return {"processed_count": processed_count, "error_count": error_count}
