from fastapi.testclient import TestClient

from api.index import app


def _client() -> TestClient:
    return TestClient(app)


def test_import_refuses_missing_visitor_id(monkeypatch):
    monkeypatch.setenv("PIPELINE_AUTH_TOKEN", "secret")
    client = _client()

    response = client.post(
        "/api/import",
        headers={"Authorization": "Bearer secret"},
        data={"keyword": "nike", "filename": "test.csv"},
        files={"file": ("test.csv", b"Text\nhello\n", "text/csv")},
    )

    # Champ Form(...) totalement absent : validation FastAPI/Pydantic elle-même
    # (422), avant même d'atteindre le corps de la fonction — même comportement
    # déjà en place pour `keyword` quand il est absent plutôt que vide.
    assert response.status_code == 422


def test_import_refuses_blank_visitor_id(monkeypatch):
    monkeypatch.setenv("PIPELINE_AUTH_TOKEN", "secret")
    client = _client()

    response = client.post(
        "/api/import",
        headers={"Authorization": "Bearer secret"},
        data={"keyword": "nike", "filename": "test.csv", "visitor_id": "   "},
        files={"file": ("test.csv", b"Text\nhello\n", "text/csv")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "visitor_id is required"
