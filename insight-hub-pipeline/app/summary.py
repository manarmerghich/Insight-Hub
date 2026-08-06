import hashlib
import json
import os
from datetime import datetime, timezone

from google import genai

from app.db import get_connection

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
    },
    "required": ["summary"],
}


def get_model() -> str:
    # Same rationale as app.sentiment.get_model()/app.themes.get_model():
    # default to the stable "-latest" alias rather than a pinned version.
    return os.environ.get("GEMINI_SUMMARY_MODEL", "gemini-flash-lite-latest")


def _format_signed(value: int) -> str:
    return f"+{value}" if value > 0 else str(value)


def _format_share(share: float) -> str:
    return f"{round(share * 100)}%"


def build_prompt(kpis: dict) -> str:
    lines = [
        "Rédige une synthèse exécutive en français, en 3 à 5 phrases, à partir "
        "des indicateurs déjà calculés ci-dessous (ne relis aucun message brut, "
        "ne relance aucune classification). Pour chaque chiffre que tu cites, "
        "reprends la comparaison et l'exemple fournis en regard quand ils sont "
        "disponibles ci-dessous — ne cite jamais un chiffre isolé sans "
        "comparaison ni exemple, et n'invente jamais de comparaison ou "
        "d'exemple qui ne figure pas dans les données ci-dessous.",
        "",
        "Indicateurs disponibles :",
    ]

    score = kpis.get("net_sentiment_score")
    if score is not None:
        line = f"- Score de sentiment net : {_format_signed(score)} pts"
        trend = kpis.get("net_sentiment_trend")
        if trend is not None:
            line += f" ({_format_signed(trend)} pts vs période précédente)"
        lines.append(line)

    top_theme = kpis.get("top_risk_theme")
    if top_theme:
        line = (
            f"- Thème le plus à risque : « {top_theme['label']} » "
            f"(score de risque {top_theme['score']})"
        )
        if top_theme.get("trend") is not None:
            line += f" ({_format_signed(top_theme['trend'])} pts vs période précédente)"
        lines.append(line)

    platforms = kpis.get("platform_distribution") or []
    if platforms:
        top_platforms = ", ".join(
            f"{p['label']} ({_format_share(p['share'])})" for p in platforms[:3]
        )
        lines.append(f"- Répartition par plateforme : {top_platforms}")

    countries = kpis.get("country_distribution") or []
    if countries:
        top_countries = ", ".join(
            f"{c['label']} ({_format_share(c['share'])})" for c in countries[:3]
        )
        lines.append(f"- Répartition par pays : {top_countries}")

    message = kpis.get("representative_message")
    if message:
        lines.append(
            f"- Exemple de message représentatif : « {message['text']} » "
            f"(par {message['user']} sur {message['platform']})"
        )

    return "\n".join(lines)


def generate_summary(client: genai.Client, model: str, kpis: dict) -> str:
    response = client.models.generate_content(
        model=model,
        contents=build_prompt(kpis),
        config={
            "response_mime_type": "application/json",
            "response_json_schema": SUMMARY_SCHEMA,
        },
    )
    payload = json.loads(response.text)
    summary = payload.get("summary", "").strip()
    if not summary:
        raise ValueError("summary generation returned an empty summary")
    return summary


def _scope_value(value) -> str:
    return "" if value is None else str(value)


def compute_scope_key(run_id: int, filters: dict, classified_count: int) -> str:
    # run_id is accepted for signature parity with the caller and with
    # design.md's description of the consultation scope, but it is
    # deliberately not folded into the hash below: `executive_summaries`
    # already disambiguates by run_id via `unique(run_id, scope_key)`, so the
    # hash only needs to cover the parts of the scope that live inside that
    # single scope_key column — the active filters and the classified
    # volume — to stay symmetric with the web's computeScopeKey(filters,
    # classifiedCount), which has no run_id to fold in either.
    del run_id
    parts = [
        _scope_value(filters.get("dateFrom")),
        _scope_value(filters.get("dateTo")),
        _scope_value(filters.get("platform")),
        _scope_value(filters.get("country")),
        _scope_value(filters.get("sentiment")),
        _scope_value(filters.get("themeId")),
        str(classified_count),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def find_cached_summary(conn, run_id: int, scope_key: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT summary_text FROM executive_summaries WHERE run_id = %s AND scope_key = %s",
            (run_id, scope_key),
        )
        row = cur.fetchone()
    return row[0] if row else None


def write_summary(conn, run_id: int, scope_key: str, summary_text: str, model: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO executive_summaries (run_id, scope_key, summary_text, model, created_at) "
            "VALUES (%s, %s, %s, %s, %s) "
            "ON CONFLICT (run_id, scope_key) DO UPDATE SET "
            "summary_text = EXCLUDED.summary_text, model = EXCLUDED.model, "
            "created_at = EXCLUDED.created_at",
            (run_id, scope_key, summary_text, model, datetime.now(timezone.utc)),
        )
    conn.commit()


def run_summary_generation(run_id: int, filters: dict, kpis: dict, *, client=None) -> dict:
    conn = None
    try:
        conn = get_connection()
        # See build_prompt/kpis contract in the web's executive-summary.ts:
        # classified_count travels inside kpis rather than as its own
        # top-level request field, to keep the endpoint's body to exactly
        # {run_id, filters, kpis} (task 2.1).
        classified_count = kpis.get("classified_count", 0)
        scope_key = compute_scope_key(run_id, filters, classified_count)

        cached = find_cached_summary(conn, run_id, scope_key)
        if cached is not None:
            return {"status": "ok", "summary": cached, "cached": True}

        if client is None:
            client = genai.Client()
        model = get_model()
        summary = generate_summary(client, model, kpis)
        write_summary(conn, run_id, scope_key, summary, model)
        return {"status": "ok", "summary": summary, "cached": False}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
    finally:
        if conn is not None:
            conn.close()
