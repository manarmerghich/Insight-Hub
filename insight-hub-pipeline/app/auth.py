import os

from fastapi import HTTPException, Request


def verify_bearer_token(request: Request) -> None:
    expected = os.environ.get("PIPELINE_AUTH_TOKEN")
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if not expected or scheme.lower() != "bearer" or token != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")
