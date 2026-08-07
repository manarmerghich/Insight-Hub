import csv
import io

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile

from app.auth import verify_bearer_token
from app.db import create_import_run, get_connection, update_run_status
from app.summary import run_summary_generation
from app.workflows import (
    run_import_pipeline,
    run_sentiment_classification,
    run_theme_classification_step,
)

app = FastAPI()


@app.post("/api/import")
async def create_import(
    request: Request,
    keyword: str = Form(...),
    filename: str = Form(...),
    visitor_id: str = Form(...),
    file: UploadFile | None = File(default=None),
    blob_url: str | None = Form(default=None),
):
    verify_bearer_token(request)

    if not keyword or not keyword.strip():
        raise HTTPException(status_code=400, detail="keyword is required")

    if not visitor_id or not visitor_id.strip():
        raise HTTPException(status_code=400, detail="visitor_id is required")

    if file is None and not blob_url:
        raise HTTPException(status_code=400, detail="file or blob_url is required")

    conn = get_connection()
    run_id = create_import_run(
        conn, keyword=keyword, source_filename=filename, visitor_id=visitor_id
    )

    try:
        if blob_url:
            # File exceeded the 4.5 MB direct-upload limit: read from Vercel
            # Blob instead of the request body.
            async with httpx.AsyncClient() as client:
                response = await client.get(blob_url)
                response.raise_for_status()
                raw_bytes = response.content
        else:
            raw_bytes = await file.read()
        rows = list(csv.DictReader(io.StringIO(raw_bytes.decode("utf-8"))))
    except Exception as exc:
        error_message = f"unreadable CSV file: {exc}"
        update_run_status(conn, run_id, "error", error_message=error_message)
        raise HTTPException(status_code=422, detail=error_message) from exc
    finally:
        conn.close()

    result = await run_import_pipeline(
        run_id=run_id, keyword=keyword, source_filename=filename, visitor_id=visitor_id, rows=rows
    )

    return {"run_id": run_id, "status": result["status"]}


@app.post("/api/sentiment/runs")
async def create_sentiment_run_endpoint(request: Request):
    verify_bearer_token(request)
    result = await run_sentiment_classification()
    return result


@app.post("/api/themes/runs")
async def create_theme_run_endpoint(request: Request):
    verify_bearer_token(request)
    result = await run_theme_classification_step()
    return result


@app.post("/api/summary")
async def create_summary_endpoint(request: Request):
    verify_bearer_token(request)

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid JSON body") from exc

    run_id = body.get("run_id") if isinstance(body, dict) else None
    kpis = body.get("kpis") if isinstance(body, dict) else None
    filters = body.get("filters") if isinstance(body, dict) else None
    filters = filters if isinstance(filters, dict) else {}

    if run_id is None or kpis is None:
        raise HTTPException(status_code=400, detail="run_id and kpis are required")

    result = run_summary_generation(run_id, filters, kpis)
    if result["status"] == "error":
        return {"status": "error", "detail": result["detail"]}
    return {"status": "ok", "summary": result["summary"], "cached": result["cached"]}
