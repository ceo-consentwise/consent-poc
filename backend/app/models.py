# app/models.py
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.types import JSON
from app.database import Base

class Consent(Base):
    __tablename__ = "consents"

    id = Column(String, primary_key=True, index=True)
    subject_id = Column(String, index=True, nullable=False)
    purpose = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default="granted")  # granted/revoked
    source = Column(String, nullable=True)
    meta = Column(JSON, nullable=True)  # JSON ok on SQLite via SQLAlchemy
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, index=True)
    consent_id = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)     # granted/revoked
    actor = Column(String, nullable=True)       # api_key/user/system
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
