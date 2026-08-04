import json
import os
import time

from google import genai

THEME_DISCOVERY_SAMPLE_SIZE = 200
BATCH_SIZE = 25
TIME_BUDGET_SECONDS = 45
MIN_THEMES = 5
MAX_THEMES = 8

DISCOVER_SCHEMA = {
    "type": "object",
    "properties": {
        "themes": {
            "type": "array",
            "minItems": MIN_THEMES,
            "maxItems": MAX_THEMES,
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["label", "description"],
            },
        },
    },
    "required": ["themes"],
}


def get_model() -> str:
    # Same rationale as app.sentiment.get_model(): default to the stable
    # "-latest" alias rather than a pinned version.
    return os.environ.get("GEMINI_THEME_MODEL", "gemini-flash-lite-latest")


def fetch_discovery_sample(conn, *, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, text FROM messages ORDER BY random() LIMIT %s", (limit,))
        rows = cur.fetchall()
    return [{"id": row[0], "text": row[1]} for row in rows]


def discover_themes(client: genai.Client, model: str, sample: list[dict]) -> list[dict]:
    prompt_lines = "\n".join(f"- {m['text']}" for m in sample)
    response = client.models.generate_content(
        model=model,
        contents=(
            "Analyse cet échantillon de messages et identifie entre 5 et 8 thèmes "
            "distincts et récurrents qui les couvrent. Pour chaque thème, donne un "
            "libellé court et une courte description.\n\n"
            f"{prompt_lines}"
        ),
        config={
            "response_mime_type": "application/json",
            "response_json_schema": DISCOVER_SCHEMA,
        },
    )
    payload = json.loads(response.text)
    themes = payload["themes"]

    exploitable = [
        {"label": t["label"].strip(), "description": t["description"].strip()}
        for t in themes
        if t.get("label", "").strip() and t.get("description", "").strip()
    ]

    if not (MIN_THEMES <= len(exploitable) <= MAX_THEMES):
        raise ValueError(
            f"discovery returned {len(exploitable)} exploitable themes, "
            f"expected between {MIN_THEMES} and {MAX_THEMES}"
        )

    return exploitable


def themes_exist(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT EXISTS(SELECT 1 FROM themes)")
        (exists,) = cur.fetchone()
    return exists


def insert_themes(conn, themes: list[dict]) -> None:
    with conn.cursor() as cur:
        for theme in themes:
            cur.execute(
                "INSERT INTO themes (label, description) VALUES (%s, %s)",
                (theme["label"], theme["description"]),
            )
    conn.commit()


def fetch_pending_messages(conn, *, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, text FROM messages WHERE theme_status IN ('pending', 'error') "
            "ORDER BY id LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [{"id": row[0], "text": row[1]} for row in rows]


def load_theme_labels(conn) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, label FROM themes")
        rows = cur.fetchall()
    return {label: theme_id for theme_id, label in rows}


def build_classify_schema(theme_labels: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "theme": {
                            "type": "string",
                            "enum": theme_labels,
                        },
                    },
                    "required": ["id", "theme"],
                },
            },
        },
        "required": ["results"],
    }


def classify_theme_batch(
    client: genai.Client,
    model: str,
    batch: list[dict],
    theme_labels: dict[str, int],
) -> dict[int, int]:
    schema = build_classify_schema(list(theme_labels.keys()))
    prompt_lines = "\n".join(f"- id {m['id']}: {m['text']}" for m in batch)
    response = client.models.generate_content(
        model=model,
        contents=(
            "Classe chaque message ci-dessous dans l'un des thèmes disponibles, "
            "d'après son contenu uniquement. Un résultat par identifiant.\n\n"
            f"{prompt_lines}"
        ),
        config={
            "response_mime_type": "application/json",
            "response_json_schema": schema,
        },
    )
    payload = json.loads(response.text)
    results: dict[int, int] = {}
    for entry in payload["results"]:
        theme_id = theme_labels.get(entry["theme"])
        if theme_id is not None:
            results[entry["id"]] = theme_id
    return results


def write_batch_results(conn, batch: list[dict], results: dict[int, int]) -> tuple[int, int]:
    processed = 0
    errors = 0
    with conn.cursor() as cur:
        for message in batch:
            theme_id = results.get(message["id"])
            if theme_id is not None:
                cur.execute(
                    "UPDATE messages SET theme_id = %s, theme_status = 'completed', "
                    "theme_error = NULL WHERE id = %s",
                    (theme_id, message["id"]),
                )
                processed += 1
            else:
                cur.execute(
                    "UPDATE messages SET theme_status = 'error', "
                    "theme_error = %s WHERE id = %s",
                    ("no classification returned for this message", message["id"]),
                )
                errors += 1
    conn.commit()
    return processed, errors


def run_theme_classification(conn, *, deadline: float | None = None, client=None) -> dict:
    if deadline is None:
        deadline = time.monotonic() + TIME_BUDGET_SECONDS

    if client is None:
        client = genai.Client()
    model = get_model()
    processed_count = 0
    error_count = 0

    if not themes_exist(conn):
        try:
            sample = fetch_discovery_sample(conn, limit=THEME_DISCOVERY_SAMPLE_SIZE)
            discovered = discover_themes(client, model, sample)
            insert_themes(conn, discovered)
        except Exception:
            # Discovery failed or returned an unusable response: no theme is
            # persisted, and classification is skipped for this invocation —
            # discovery will simply be retried on the next one.
            return {"processed_count": 0, "error_count": 0}

    theme_labels = load_theme_labels(conn)

    while time.monotonic() < deadline:
        batch = fetch_pending_messages(conn, limit=BATCH_SIZE)
        if not batch:
            break

        try:
            results = classify_theme_batch(client, model, batch, theme_labels)
        except Exception:
            results = {}

        processed, errors = write_batch_results(conn, batch, results)
        processed_count += processed
        error_count += errors

    return {"processed_count": processed_count, "error_count": error_count}
