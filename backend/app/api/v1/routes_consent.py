# backend/app/api/v1/routes_consent.py
from fastapi import APIRouter, HTTPException, Depends, Response, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from uuid import uuid4
from sqlalchemy.orm import Session
from datetime import datetime
import csv
import io

from sqlalchemy import func
from app.deps import get_db, get_actor
from app.models import Consent, AuditLog, ConsentTemplate

router = APIRouter()

# ============================
# Pydantic Schemas
# ============================

class ConsentCreate(BaseModel):
    subject_id: str = Field(..., example="user-123")

    # Preferred domain field:
    data_use_case: Optional[str] = Field(
        None,
        example="marketing",
        description="Preferred field for purpose",
    )
    # Legacy alias still accepted so older clients keep working:
    purpose: Optional[str] = Field(
        None,
        example="marketing",
        description="Legacy alias for purpose",
    )

    source: Optional[str] = "web_form"
    meta: Optional[Dict] = None

    # --- Phase-II BFSI optional fields (all nullable) ---
    tenant_id: Optional[str] = None
    product_id: Optional[str] = None

    # NOTE: we do NOT redefine 'purpose' again here.
    # BFSI purpose taxonomy still uses the same purpose/data_use_case field above.

    source_channel: Optional[str] = None         # e.g. web_app_customer, web_app_branch_officer
    actor_type: Optional[str] = None             # e.g. customer, branch_officer

    application_number: Optional[str] = None     # e.g. APP12345
    mobile_number: Optional[str] = None

    version: Optional[int] = None                # consent version
    evidence_ref: Optional[str] = None           # OTP txn id or other proof

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

    # --- Phase-II BFSI optional fields (all nullable) ---
    tenant_id: Optional[str] = None
    product_id: Optional[str] = None

    source_channel: Optional[str] = None
    actor_type: Optional[str] = None

    application_number: Optional[str] = None
    mobile_number: Optional[str] = None

    version: Optional[int] = None
    evidence_ref: Optional[str] = None

    class Config:
        orm_mode = True

class ConsentTemplateOut(BaseModel):
    id: str
    tenant_id: str
    product_id: str
    purpose: str
    template_type: str
    version: int
    title: Optional[str] = None
    body_text: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class ConsentTemplateCreate(BaseModel):
    tenant_id: str
    product_id: str
    purpose: str
    template_type: str
    title: Optional[str] = None
    body_text: Optional[str] = None
    is_active: Optional[bool] = True

# ============================
# Helpers
# ============================

def _row_to_out(c: Consent) -> ConsentOut:
    return ConsentOut(
        id=c.id,
        subject_id=c.subject_id,
        data_use_case=c.purpose,
        purpose=c.purpose,
        source=c.source,
        meta=c.meta,
        status=c.status,

        # --- Phase-II BFSI fields ---
        tenant_id=getattr(c, "tenant_id", None),
        product_id=getattr(c, "product_id", None),
        source_channel=getattr(c, "source_channel", None),
        actor_type=getattr(c, "actor_type", None),
        application_number=getattr(c, "application_number", None),
        mobile_number=getattr(c, "mobile_number", None),
        version=getattr(c, "version", None),
        evidence_ref=getattr(c, "evidence_ref", None),
    )


# ============================
# Routes
# ============================

# --- IMPORTANT: export route MUST come BEFORE "/{consent_id}" to avoid being swallowed ---

@router.get(
    "/export.csv",
    summary="Export consents as CSV (optionally filter by subject_id and/or date range via AuditLog timestamps)",
    response_class=Response,
)
def export_consents_csv(
    subject_id: Optional[str] = Query(None, description="Filter by subject_id"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD (inclusive) - compared against audit timestamps"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD (inclusive) - compared against audit timestamps"),
    db: Session = Depends(get_db),
):
    """
    Exports consents as CSV.
    - If date range is provided, we include consents which have ANY audit event within that range.
    - If only subject_id is provided, we export consents for that subject.
    - If nothing provided, we export all consents.
    """
    q = db.query(Consent)

    if subject_id:
        q = q.filter(Consent.subject_id == subject_id)

    # If date filters present, restrict by audit events in range
    # We use AuditLog.timestamp (common in your project) to filter.
    # If your column name differs, update here.
    if start_date or end_date:
        # Parse bounds
        start_dt: Optional[datetime] = None
        end_dt: Optional[datetime] = None
        try:
            if start_date:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            if end_date:
                # end of day inclusive
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

        # Join with AuditLog to find consents that have at least one event in range
        aq = db.query(AuditLog.consent_id)
        if start_dt:
            aq = aq.filter(AuditLog.timestamp >= start_dt)
        if end_dt:
            aq = aq.filter(AuditLog.timestamp <= end_dt)
        consent_ids_in_range = {row[0] for row in aq.distinct().all()}

        if consent_ids_in_range:
            q = q.filter(Consent.id.in_(consent_ids_in_range))
        else:
            # No results in range -> return an empty CSV, not a 404
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["id", "subject_id", "data_use_case", "status", "source", "meta_json"])
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="consents.csv"'},
            )

    rows: List[Consent] = q.all()

    # Build CSV (empty CSV is OK; don't 404)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "subject_id", "data_use_case", "status", "source", "meta_json"])
    for c in rows:
        meta_str = ""
        try:
            # write meta as JSON-esque string
            meta_str = "" if c.meta is None else str(c.meta)
        except Exception:
            meta_str = ""
        writer.writerow([c.id, c.subject_id, c.purpose, c.status, c.source or "", meta_str])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="consents.csv"'},
    )


@router.post(
    "/",
    response_model=ConsentOut,
    status_code=201,
    summary="Grant consent",
)
def grant_consent(
    payload: ConsentCreate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),  # header X-Actor, defaults to 'web_form'
):
    use_case = payload.resolved_use_case()
    if not use_case:
        raise HTTPException(status_code=422, detail="data_use_case (or purpose) is required")

    consent_id = str(uuid4())
    consent = Consent(
    id=consent_id,
    subject_id=payload.subject_id,
    # DB column is named `purpose`; we store the resolved use case in it
    purpose=use_case,
    status="granted",
    source=payload.source,
    meta=payload.meta,

    # --- Phase-II BFSI fields (all optional/nullable in the DB) ---
    tenant_id=getattr(payload, "tenant_id", None),
    product_id=getattr(payload, "product_id", None),
    source_channel=getattr(payload, "source_channel", None),
    actor_type=getattr(payload, "actor_type", None),
    application_number=getattr(payload, "application_number", None),
    mobile_number=getattr(payload, "mobile_number", None),
    version=getattr(payload, "version", None),
    evidence_ref=getattr(payload, "evidence_ref", None),
)
    db.add(consent)


    db.add(
        AuditLog(
            id=str(uuid4()),
            consent_id=consent_id,
            action="granted",
            actor=actor,

            # BFSI context snapshot from the consent row
            product_id=consent.product_id,
            purpose=consent.purpose,
            source_channel=getattr(consent, "source_channel", None),
            actor_type=getattr(consent, "actor_type", None),
            application_number=getattr(consent, "application_number", None),
            mobile_number=getattr(consent, "mobile_number", None),
            evidence_ref=getattr(consent, "evidence_ref", None),

            # Keep existing details behavior
            details=payload.meta,
        )
    )


    db.commit()

    return _row_to_out(consent)


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
    return [_row_to_out(c) for c in rows]

# ============================
# Consent Template management
# ============================

@router.get(
    "/templates",
    response_model=List[ConsentTemplateOut],
    summary="List consent templates",
)
def list_consent_templates(
    db: Session = Depends(get_db),
):
    q = (
        db.query(ConsentTemplate)
        .order_by(
            ConsentTemplate.tenant_id,
            ConsentTemplate.product_id,
            ConsentTemplate.purpose,
            ConsentTemplate.template_type,
            ConsentTemplate.version,
        )
    )
    return q.all()


@router.post(
    "/templates",
    response_model=ConsentTemplateOut,
    status_code=201,
    summary="Create a new consent template version",
)
def create_consent_template(
    payload: ConsentTemplateCreate,
    db: Session = Depends(get_db),
):
    # Determine next version based on existing templates for this combination
    max_version = (
        db.query(func.max(ConsentTemplate.version))
        .filter(
            ConsentTemplate.tenant_id == payload.tenant_id,
            ConsentTemplate.product_id == payload.product_id,
            ConsentTemplate.purpose == payload.purpose,
            ConsentTemplate.template_type == payload.template_type,
        )
        .scalar()
    ) or 0

    next_version = max_version + 1

    tmpl = ConsentTemplate(
        id=str(uuid4()),
        tenant_id=payload.tenant_id,
        product_id=payload.product_id,
        purpose=payload.purpose,
        template_type=payload.template_type,
        version=next_version,
        title=payload.title,
        body_text=payload.body_text,
        is_active=True if payload.is_active is None else payload.is_active,
    )

    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


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
    return _row_to_out(c)


@router.patch(
    "/{consent_id}/revoke",
    response_model=ConsentOut,
    summary="Revoke consent",
)
def revoke_consent(
    consent_id: str,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
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
            actor=actor,

            # BFSI context snapshot at time of revocation
            product_id=c.product_id,
            purpose=c.purpose,
            source_channel=getattr(c, "source_channel", None),
            actor_type=getattr(c, "actor_type", None),
            application_number=getattr(c, "application_number", None),
            mobile_number=getattr(c, "mobile_number", None),
            evidence_ref=getattr(c, "evidence_ref", None),

            details={"reason": "user_action"},
        )
    )



    

    db.commit()
    return _row_to_out(c)
