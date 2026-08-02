import csv
import io

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile

from app.auth import verify_bearer_token
from app.db import create_import_run, get_connection, update_run_status
from app.workflows import run_import_pipeline

app = FastAPI()


@app.post("/api/import")
async def create_import(
    request: Request,
    keyword: str = Form(...),
    filename: str = Form(...),
    file: UploadFile | None = File(default=None),
    blob_url: str | None = Form(default=None),
):
    verify_bearer_token(request)

    if not keyword or not keyword.strip():
        raise HTTPException(status_code=400, detail="keyword is required")

    if file is None and not blob_url:
        raise HTTPException(status_code=400, detail="file or blob_url is required")

    conn = get_connection()
    run_id = create_import_run(conn, keyword=keyword, source_filename=filename)

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
        run_id=run_id, keyword=keyword, source_filename=filename, rows=rows
    )

    return {"run_id": run_id, "status": result["status"]}
