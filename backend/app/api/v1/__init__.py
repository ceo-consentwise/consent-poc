# backend/app/api/v1/__init__.py
from fastapi import APIRouter
from .routes_consent import router as consents_router
from .routes_audit import router as audit_router
from .routes_ingest import router as ingest_router


api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(consents_router, prefix="/consents", tags=["consents"])
api_v1.include_router(audit_router, prefix="/audit", tags=["audit"])
api_v1.include_router(ingest_router, prefix="/ingest", tags=["ingestion"])


