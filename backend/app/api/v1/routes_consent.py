from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from uuid import uuid4
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Consent, AuditLog

router = APIRouter()

# Schemas
class ConsentCreate(BaseModel):
    subject_id: str = Field(..., example="user-123")
    purpose: str = Field(..., example="marketing")
    source: Optional[str] = "web_form"
    meta: Optional[Dict] = None

class ConsentOut(ConsentCreate):
    id: str
    status: str

# Grant
@router.post("/", response_model=ConsentOut, status_code=201, summary="Grant consent")
def grant_consent(payload: ConsentCreate, db: Session = Depends(get_db)):
    consent_id = str(uuid4())
    consent = Consent(
        id=consent_id,
        subject_id=payload.subject_id,
        purpose=payload.purpose,
        status="granted",
        source=payload.source,
        meta=payload.meta,
    )
    db.add(consent)
    db.add(AuditLog(
        id=str(uuid4()),
        consent_id=consent_id,
        action="granted",
        actor=payload.source or "system",
        details=payload.meta,
    ))
    db.commit()
    return ConsentOut(id=consent_id, status="granted", **payload.dict())

# Get by ID
@router.get("/{consent_id}", response_model=ConsentOut, summary="Get consent by ID")
def get_consent(consent_id: str, db: Session = Depends(get_db)):
    consent = db.query(Consent).filter(Consent.id == consent_id).first()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    return ConsentOut(
        id=consent.id,
        subject_id=consent.subject_id,
        purpose=consent.purpose,
        source=consent.source,
        meta=consent.meta,
        status=consent.status,
    )

# List (handy for quick checks)
@router.get("/", response_model=List[ConsentOut], summary="List consents")
def list_consents(subject_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Consent)
    if subject_id:
        q = q.filter(Consent.subject_id == subject_id)
    return [
        ConsentOut(
            id=c.id, subject_id=c.subject_id, purpose=c.purpose,
            source=c.source, meta=c.meta, status=c.status
        )
        for c in q.all()
    ]

# Revoke
@router.patch("/{consent_id}/revoke", response_model=ConsentOut, summary="Revoke consent")
def revoke_consent(consent_id: str, db: Session = Depends(get_db)):
    consent = db.query(Consent).filter(Consent.id == consent_id).first()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    consent.status = "revoked"
    db.add(AuditLog(
        id=str(uuid4()), consent_id=consent_id, action="revoked",
        actor="system", details={"reason": "user_action"}
    ))
    db.commit()
    return ConsentOut(
        id=consent.id, subject_id=consent.subject_id, purpose=consent.purpose,
        source=consent.source, meta=consent.meta, status=consent.status
    )
