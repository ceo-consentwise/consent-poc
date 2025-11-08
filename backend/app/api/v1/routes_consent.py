# backend/app/api/v1/routes_consent.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from uuid import uuid4
from sqlalchemy.orm import Session

from app.deps import get_db, get_actor
from app.models import Consent, AuditLog

router = APIRouter()


# ============================
# Pydantic Schemas
# ============================

class ConsentCreate(BaseModel):
    subject_id: str = Field(..., example="user-123")
    # Preferred field in our domain language:
    data_use_case: Optional[str] = Field(
        None, example="marketing", description="Preferred field for purpose"
    )
    # Legacy alias still accepted so we don't break older clients:
    purpose: Optional[str] = Field(
        None, example="marketing", description="Legacy alias; still accepted"
    )
    source: Optional[str] = "web_form"
    meta: Optional[Dict] = None

    def resolved_use_case(self) -> str:
        """Prefer data_use_case; fall back to purpose."""
        return (self.data_use_case or self.purpose or "").strip()


class ConsentOut(BaseModel):
    id: str
    subject_id: str
    data_use_case: str
    purpose: str               # echo the same value for clarity/compat
    source: Optional[str] = None
    meta: Optional[Dict] = None
    status: str

    class Config:
        orm_mode = True


# ============================
# Routes
# ============================

@router.post(
    "/",
    response_model=ConsentOut,
    status_code=201,
    summary="Grant consent",
)
def grant_consent(
    payload: ConsentCreate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),  # <-- capture operator from header
):
    use_case = payload.resolved_use_case()
    if not use_case:
        raise HTTPException(
            status_code=422,
            detail="data_use_case (or purpose) is required",
        )

    consent_id = str(uuid4())
    consent = Consent(
        id=consent_id,
        subject_id=payload.subject_id,
        # DB column is named `purpose`; we store the resolved use case in it
        purpose=use_case,
        status="granted",
        source=payload.source,
        meta=payload.meta,
    )
    db.add(consent)

    db.add(
        AuditLog(
            id=str(uuid4()),
            consent_id=consent_id,
            action="granted",
            actor=actor,            # <-- record who performed it
            details=payload.meta,
        )
    )

    db.commit()

    return ConsentOut(
        id=consent_id,
        subject_id=payload.subject_id,
        data_use_case=use_case,
        purpose=use_case,         # mirror for legacy clarity
        source=payload.source,
        meta=payload.meta,
        status="granted",
    )


@router.get(
    "/{consent_id}",
    response_model=ConsentOut,
    summary="Get consent by ID",
)
def get_consent(
    consent_id: str,
    db: Session = Depends(get_db),
):
    c = db.query(Consent).filter(Consent.id == consent_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consent not found")

    return ConsentOut(
        id=c.id,
        subject_id=c.subject_id,
        data_use_case=c.purpose,
        purpose=c.purpose,
        source=c.source,
        meta=c.meta,
        status=c.status,
    )


@router.get(
    "/",
    response_model=List[ConsentOut],
    summary="List consents",
)
def list_consents(
    subject_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Consent)
    if subject_id:
        q = q.filter(Consent.subject_id == subject_id)
    rows = q.all()
    return [
        ConsentOut(
            id=c.id,
            subject_id=c.subject_id,
            data_use_case=c.purpose,
            purpose=c.purpose,
            source=c.source,
            meta=c.meta,
            status=c.status,
        )
        for c in rows
    ]


@router.patch(
    "/{consent_id}/revoke",
    response_model=ConsentOut,
    summary="Revoke consent",
)
def revoke_consent(
    consent_id: str,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),   # <-- capture operator from header
):
    c = db.query(Consent).filter(Consent.id == consent_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consent not found")

    c.status = "revoked"

    db.add(
        AuditLog(
            id=str(uuid4()),
            consent_id=consent_id,
            action="revoked",
            actor=actor,            # <-- record who performed it
            details={"reason": "user_action"},
        )
    )

    db.commit()

    return ConsentOut(
        id=c.id,
        subject_id=c.subject_id,
        data_use_case=c.purpose,
        purpose=c.purpose,
        source=c.source,
        meta=c.meta,
        status=c.status,
    )