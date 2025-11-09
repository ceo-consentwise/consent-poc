# backend/app/deps.py
from typing import Generator
from fastapi import Header
from app.database import SessionLocal

def get_db() -> Generator:
    """
    FastAPI dependency that yields a SQLAlchemy session and closes it after use.
    This returns a real Session object (not a contextmanager), so db.query() works.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_actor(x_actor: str | None = Header(default=None)) -> str:
    """
    Keep a simple actor header for audit notes; not used for authorization now.
    """
    return x_actor or "web_form"
