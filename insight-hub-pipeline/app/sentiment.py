import json
import os
import time

from google import genai

BATCH_SIZE = 25
TIME_BUDGET_SECONDS = 45
VALID_SENTIMENTS = {"positif", "négatif", "neutre"}

CLASSIFY_SCHEMA = {
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
            },
        },
    },
    "required": ["results"],
}


def get_model() -> str:
    # gemini-2.5-flash-lite is rejected (404) for API keys created after its
    # cutoff — confirmed against a real key — so default to the stable
    # "-latest" alias instead of a pinned version.
    return os.environ.get("GEMINI_SENTIMENT_MODEL", "gemini-flash-lite-latest")


def fetch_pending_messages(conn, *, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, text FROM messages WHERE sentiment_status IN ('pending', 'error') "
            "ORDER BY id LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [{"id": row[0], "text": row[1]} for row in rows]


def classify_batch(client: genai.Client, model: str, batch: list[dict]) -> dict[int, str]:
    prompt_lines = "\n".join(f"- id {m['id']}: {m['text']}" for m in batch)
    response = client.models.generate_content(
        model=model,
        contents=(
            "Classe chaque message ci-dessous en positif, négatif ou neutre, "
            "d'après son contenu uniquement. Un résultat par identifiant.\n\n"
            f"{prompt_lines}"
        ),
        config={
            "response_mime_type": "application/json",
            "response_json_schema": CLASSIFY_SCHEMA,
        },
    )
    payload = json.loads(response.text)
    results: dict[int, str] = {}
    for entry in payload["results"]:
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
        client = genai.Client()
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
