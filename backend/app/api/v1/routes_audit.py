from fastapi import APIRouter, Depends
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse
import csv
import io

from app.deps import get_db
from app.models import AuditLog

router = APIRouter()


@router.get("/", summary="List audit events")
def list_audit(
    consent_id: Optional[str] = None,
    mobile_number: Optional[str] = None,
    application_number: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    List audit events.

    - If consent_id is provided, filter by that consent_id.
    - If mobile_number / application_number are provided, filter by those.
    - If multiple filters are provided, all are applied (AND).
    """
    q = db.query(AuditLog)

    if consent_id:
        q = q.filter(AuditLog.consent_id == consent_id)
    if mobile_number:
        q = q.filter(AuditLog.mobile_number == mobile_number)
    if application_number:
        q = q.filter(AuditLog.application_number == application_number)

    rows = q.order_by(AuditLog.timestamp.asc()).all()

    out = []
    for a in rows:
        out.append(
            {
                "id": a.id,
                "consent_id": a.consent_id,
                "timestamp": a.timestamp.isoformat()
                if getattr(a, "timestamp", None)
                else None,
                "action": a.action,
                "actor": a.actor,
                "details": a.details,
                # BFSI context fields
                "product_id": getattr(a, "product_id", None),
                "purpose": getattr(a, "purpose", None),
                "source_channel": getattr(a, "source_channel", None),
                "actor_type": getattr(a, "actor_type", None),
                "application_number": getattr(a, "application_number", None),
                "mobile_number": getattr(a, "mobile_number", None),
                "evidence_ref": getattr(a, "evidence_ref", None),
            }
        )
    return out


@router.get("/export.csv", summary="Export audit as CSV")
def export_audit_csv(
    consent_id: Optional[str] = None,
    mobile_number: Optional[str] = None,
    application_number: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Export audit events to CSV.

    Same filters as list_audit:
    - consent_id (optional)
    - mobile_number (optional)
    - application_number (optional)
    """
    q = db.query(AuditLog)

    if consent_id:
        q = q.filter(AuditLog.consent_id == consent_id)
    if mobile_number:
        q = q.filter(AuditLog.mobile_number == mobile_number)
    if application_number:
        q = q.filter(AuditLog.application_number == application_number)

    rows = q.order_by(AuditLog.timestamp.asc()).all()

    output = io.StringIO()

    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "consent_id",
            "timestamp",
            "action",
            "actor",
            "product_id",
            "purpose",
            "source_channel",
            "actor_type",
            "application_number",
            "mobile_number",
            "evidence_ref",
            "details",
        ]
    )
    for a in rows:
        writer.writerow(
            [
                a.id,
                a.consent_id,
                (
                    a.timestamp.isoformat()
                    if getattr(a, "timestamp", None)
                    else ""
                ),
                a.action or "",
                a.actor or "",
                getattr(a, "product_id", "") or "",
                getattr(a, "purpose", "") or "",
                getattr(a, "source_channel", "") or "",
                getattr(a, "actor_type", "") or "",
                getattr(a, "application_number", "") or "",
                getattr(a, "mobile_number", "") or "",
                getattr(a, "evidence_ref", "") or "",
                (
                    a.details
                    if isinstance(a.details, str)
                    else ("" if a.details is None else str(a.details))
                ),
            ]
        )

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_export.csv"},
    )
