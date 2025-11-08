from app.database import SessionLocal
from fastapi import Header

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_actor(x_actor: str | None = Header(default=None)) -> str:
    """
    Returns the operator/actor performing the request.
    Reads X-Actor header; falls back to 'web_form' for the PoC.
    """
    return x_actor or "web_form"
