# backend/app/api/v1/routes_audit.py
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
def list_audit(consent_id: Optional[str] = None, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    q = db.query(AuditLog)
    if consent_id:
        q = q.filter(AuditLog.consent_id == consent_id)
    rows = q.order_by(AuditLog.timestamp.asc()).all()
    out = []
    for a in rows:
        out.append({
            "id": a.id,
            "consent_id": a.consent_id,
            "timestamp": a.timestamp.isoformat() if getattr(a, "timestamp", None) else None,
            "action": a.action,
            "actor": a.actor,
            "details": a.details,
        })
    return out

@router.get("/export.csv", summary="Export audit as CSV")
def export_audit_csv(consent_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if consent_id:
        q = q.filter(AuditLog.consent_id == consent_id)
    rows = q.order_by(AuditLog.timestamp.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "consent_id", "timestamp", "action", "actor", "details"])
    for a in rows:
        writer.writerow([
            a.id,
            a.consent_id,
            (a.timestamp.isoformat() if getattr(a, "timestamp", None) else ""),
            a.action or "",
            a.actor or "",
            (a.details if isinstance(a.details, str) else ("" if a.details is None else str(a.details)))
        ])
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_export.csv"},
    )
