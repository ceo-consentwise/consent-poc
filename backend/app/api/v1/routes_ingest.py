from datetime import datetime, timedelta
from typing import Dict, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.deps import get_db        # <-- match routes_consent.py style
from app.models import OtpTransaction, Consent, AuditLog, ConsentTemplate
from .routes_consent import ConsentOut, _row_to_out  # reuse existing response schema + mapper


router = APIRouter(
    # IMPORTANT: no prefix here; api_v1.include_router adds /ingest
    tags=["ingestion"],
)

# For now we are in pure PoC mode: fixed OTP
SIMULATED_OTP = "123456"
OTP_EXPIRY_MINUTES = 5


# --------- Pydantic Schemas ---------

class CustomerLoginInitiateRequest(BaseModel):
    mobile_number: str = Field(..., example="9999999999")
    application_number: Optional[str] = Field(
        None, example="APP12345", description="Optional application/journey id"
    )


class CustomerLoginInitiateResponse(BaseModel):
    transaction_id: str
    mode: str = "SIMULATED"
    otp: Optional[str] = None  # present only in simulated mode for demo


class CustomerVerifyOtpRequest(BaseModel):
    transaction_id: str
    otp: str = Field(..., example="123456")


class CustomerVerifyOtpResponse(BaseModel):
    status: str
    transaction_id: str
    mobile_number: str
    application_number: Optional[str] = None


class BranchInitiateRequest(BaseModel):
    # In a real system, branch officer auth would come from session/JWT.
    # For PoC, we just accept an ID here and trust it.
    branch_officer_id: str = Field(..., example="bo_user")
    mobile_number: str = Field(..., example="9999999999")
    application_number: Optional[str] = Field(None, example="APP12345")


class BranchInitiateResponse(BaseModel):
    transaction_id: str
    mode: str = "SIMULATED"
    otp: Optional[str] = None  # present only in simulated mode


class BranchVerifyOtpRequest(BaseModel):
    transaction_id: str
    otp: str = Field(..., example="123456")


class BranchVerifyOtpResponse(BaseModel):
    status: str
    transaction_id: str
    mobile_number: str
    application_number: Optional[str] = None
    branch_officer_id: Optional[str] = None


class CustomerConsentRequest(BaseModel):
    transaction_id: str = Field(..., description="OTP transaction id from customer.verify-otp")
    tenant_id: Optional[str] = None
    product_id: Optional[str] = None
    purpose: str = Field(..., description="Consent purpose / use case, e.g. REGULATORY / SERVICE / MARKETING")
    version: Optional[int] = None
    meta: Optional[Dict] = None


class BranchConsentRequest(BaseModel):
    transaction_id: str = Field(..., description="OTP transaction id from branch.verify-otp")
    branch_officer_id: str = Field(..., example="bo_user")
    tenant_id: Optional[str] = None
    product_id: Optional[str] = None
    purpose: str = Field(..., description="Consent purpose / use case, e.g. REGULATORY / SERVICE / MARKETING")
    version: Optional[int] = None
    meta: Optional[Dict] = None


# --------- Helper functions ---------


def _create_otp_transaction(
    db: Session,
    *,
    mobile_number: str,
    channel: str,
    application_number: Optional[str] = None,
) -> OtpTransaction:
    """Create a new OTP transaction in SIMULATED mode."""
    transaction_id = f"{channel}-{int(datetime.utcnow().timestamp())}"

    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    otp_txn = OtpTransaction(
        transaction_id=transaction_id,
        mobile_number=mobile_number,
        channel=channel,
        application_number=application_number,
        otp_hash=SIMULATED_OTP,   # For PoC, we store OTP directly; later we'll hash it.
        expires_at=expires_at,
        created_at=datetime.utcnow(),
    )
    db.add(otp_txn)
    db.commit()
    db.refresh(otp_txn)
    return otp_txn


def _validate_otp_transaction(
    db: Session,
    *,
    transaction_id: str,
    otp: str,
    expected_channel: Optional[str] = None,
) -> OtpTransaction:
    """Validate OTP for a transaction in SIMULATED mode."""
    otp_txn = (
        db.query(OtpTransaction)
        .filter(OtpTransaction.transaction_id == transaction_id)
        .first()
    )

    if not otp_txn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction_id",
        )

    if expected_channel and otp_txn.channel != expected_channel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel mismatch for transaction",
        )

    if otp_txn.verified_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP already used",
        )

    if otp_txn.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired",
        )

    if otp_txn.otp_hash != otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP",
        )

    # Mark as verified
    otp_txn.verified_at = datetime.utcnow()
    db.add(otp_txn)
    db.commit()
    db.refresh(otp_txn)

    return otp_txn


def _get_verified_otp_txn_for_consent(
    db: Session,
    *,
    transaction_id: str,
    expected_channel: str,
) -> OtpTransaction:
    """
    Fetch an OTP transaction that has already passed OTP verification
    and is ready to be used for consent creation.
    """
    otp_txn = (
        db.query(OtpTransaction)
        .filter(OtpTransaction.transaction_id == transaction_id)
        .first()
    )

    if not otp_txn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction_id",
        )

    if otp_txn.channel != expected_channel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Channel mismatch for transaction",
        )

    if otp_txn.verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not yet verified for this transaction",
        )

    if otp_txn.consent_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent already created for this transaction",
        )

    return otp_txn


def _get_active_template(
    db: Session,
    *,
    tenant_id: Optional[str],
    product_id: Optional[str],
    purpose: str,
) -> ConsentTemplate:
    """
    Pick the active consent template for (tenant, product, purpose).

    We look up ConsentTemplate where:
      - product_id matches (required)
      - purpose matches (required)
      - tenant_id matches, if provided (optional filter)
      - is_active == True

    And we return the highest version (latest template).
    """
    if not product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="product_id is required to resolve consent template",
        )

    q = db.query(ConsentTemplate).filter(
        ConsentTemplate.product_id == product_id,
        ConsentTemplate.purpose == purpose,
        ConsentTemplate.is_active == True,  # noqa: E712
    )

    if tenant_id:
        q = q.filter(ConsentTemplate.tenant_id == tenant_id)

    template = q.order_by(ConsentTemplate.version.desc()).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active consent template configured for this product/purpose",
        )

    return template


# --------- Customer ingestion endpoints ---------


@router.post(
    "/customer/login-initiate",
    response_model=CustomerLoginInitiateResponse,
    status_code=status.HTTP_200_OK,
)
def customer_login_initiate(
    payload: CustomerLoginInitiateRequest,
    db: Session = Depends(get_db),
):
    """
    Start a customer login / consent flow: generate OTP in SIMULATED mode.
    In future, this will call SMS gateway instead of returning otp.
    """
    otp_txn = _create_otp_transaction(
        db,
        mobile_number=payload.mobile_number,
        channel="customer_login",
        application_number=payload.application_number,
    )
    return CustomerLoginInitiateResponse(
        transaction_id=otp_txn.transaction_id,
        mode="SIMULATED",
        otp=SIMULATED_OTP,
    )


@router.post(
    "/customer/verify-otp",
    response_model=CustomerVerifyOtpResponse,
    status_code=status.HTTP_200_OK,
)
def customer_verify_otp(
    payload: CustomerVerifyOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Verify OTP for a customer login flow.
    For now, this only validates OTP & marks the otp_transaction as verified.
    """
    otp_txn = _validate_otp_transaction(
        db,
        transaction_id=payload.transaction_id,
        otp=payload.otp,
        expected_channel="customer_login",
    )
    return CustomerVerifyOtpResponse(
        status="verified",
        transaction_id=otp_txn.transaction_id,
        mobile_number=otp_txn.mobile_number,
        application_number=otp_txn.application_number,
    )


@router.post(
    "/customer/consent",
    response_model=ConsentOut,
    status_code=status.HTTP_201_CREATED,
)
def customer_create_consent(
    payload: CustomerConsentRequest,
    db: Session = Depends(get_db),
):
    """
    Create a consent after a customer OTP flow has been verified.

    subject_id: derived from otp_txn.application_number (fallback to mobile_number if needed)
    evidence_ref: otp_txn.transaction_id
    Template version & template_id: derived from ConsentTemplate.
    """
    otp_txn = _get_verified_otp_txn_for_consent(
        db,
        transaction_id=payload.transaction_id,
        expected_channel="customer_login",
    )

    # Subject id strategy: application_number (as you requested)
    subject_id = otp_txn.application_number or otp_txn.mobile_number
    if not subject_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot derive subject_id (no application_number or mobile_number on OTP transaction)",
        )

    # Resolve tenant/product/purpose for template lookup
    tenant_id = payload.tenant_id
    product_id = payload.product_id
    purpose = payload.purpose

    template = _get_active_template(
        db,
        tenant_id=tenant_id,
        product_id=product_id,
        purpose=purpose,
    )

    consent_id = str(uuid4())

    consent = Consent(
        id=consent_id,
        subject_id=subject_id,
        # We store the use case/purpose in the `purpose` column as done in routes_consent
        purpose=purpose,
        status="granted",
        source="web_ingestion_customer",
        meta=payload.meta,
        tenant_id=tenant_id,
        product_id=product_id,
        source_channel="web_app_customer",
        actor_type="customer",
        application_number=otp_txn.application_number,
        mobile_number=otp_txn.mobile_number,
        template_id=template.id,
        version=template.version,
        evidence_ref=otp_txn.transaction_id,
    )

    db.add(consent)
    db.flush()  # get consent.id without full commit yet

    # Write a 'granted' audit log for ingestion-based consent
    db.add(
        AuditLog(
            id=str(uuid4()),
            consent_id=consent.id,
            action="granted",
            actor="customer_ingestion",  # label; can be changed later if needed

            product_id=consent.product_id,
            purpose=consent.purpose,
            source_channel=getattr(consent, "source_channel", None),
            actor_type=getattr(consent, "actor_type", None),
            application_number=getattr(consent, "application_number", None),
            mobile_number=getattr(consent, "mobile_number", None),
            evidence_ref=getattr(consent, "evidence_ref", None),

            details=payload.meta,
        )
    )

    # Link otp transaction to this consent
    otp_txn.consent_id = consent.id
    db.add(otp_txn)

    db.commit()
    db.refresh(consent)

    return _row_to_out(consent)


# --------- Branch officer ingestion endpoints ---------


@router.post(
    "/branch/initiate",
    response_model=BranchInitiateResponse,
    status_code=status.HTTP_200_OK,
)
def branch_initiate(
    payload: BranchInitiateRequest,
    db: Session = Depends(get_db),
):
    """
    Start a branch officer–initiated consent flow.
    For now, we only generate OTP for the customer's mobile in SIMULATED mode.
    """
    otp_txn = _create_otp_transaction(
        db,
        mobile_number=payload.mobile_number,
        channel="branch_consent",
        application_number=payload.application_number,
    )
    return BranchInitiateResponse(
        transaction_id=otp_txn.transaction_id,
        mode="SIMULATED",
        otp=SIMULATED_OTP,
    )


@router.post(
    "/branch/verify-otp",
    response_model=BranchVerifyOtpResponse,
    status_code=status.HTTP_200_OK,
)
def branch_verify_otp(
    payload: BranchVerifyOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Verify OTP for a branch officer–initiated consent flow.
    This does NOT create the consent record; that is done by branch/consent.
    """
    otp_txn = _validate_otp_transaction(
        db,
        transaction_id=payload.transaction_id,
        otp=payload.otp,
        expected_channel="branch_consent",
    )

    return BranchVerifyOtpResponse(
        status="verified",
        transaction_id=otp_txn.transaction_id,
        mobile_number=otp_txn.mobile_number,
        application_number=otp_txn.application_number,
        branch_officer_id=None,
    )


@router.post(
    "/branch/consent",
    response_model=ConsentOut,
    status_code=status.HTTP_201_CREATED,
)
def branch_create_consent(
    payload: BranchConsentRequest,
    db: Session = Depends(get_db),
):
    """
    Create a consent after a branch-initiated OTP flow has been verified.

    subject_id: derived from otp_txn.application_number (fallback to mobile_number if needed)
    actor_type: branch_officer
    source_channel: web_app_branch_officer
    Template version & template_id: derived from ConsentTemplate.
    """
    otp_txn = _get_verified_otp_txn_for_consent(
        db,
        transaction_id=payload.transaction_id,
        expected_channel="branch_consent",
    )

    subject_id = otp_txn.application_number or otp_txn.mobile_number
    if not subject_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot derive subject_id (no application_number or mobile_number on OTP transaction)",
        )

    tenant_id = payload.tenant_id
    product_id = payload.product_id
    purpose = payload.purpose

    template = _get_active_template(
        db,
        tenant_id=tenant_id,
        product_id=product_id,
        purpose=purpose,
    )

    consent_id = str(uuid4())

    consent = Consent(
        id=consent_id,
        subject_id=subject_id,
        purpose=purpose,
        status="granted",
        source="web_ingestion_branch",
        meta=payload.meta,
        tenant_id=tenant_id,
        product_id=product_id,
        source_channel="web_app_branch_officer",
        actor_type="branch_officer",
        application_number=otp_txn.application_number,
        mobile_number=otp_txn.mobile_number,
        template_id=template.id,
        version=template.version,
        evidence_ref=otp_txn.transaction_id,
    )

    db.add(consent)
    db.flush()

    # Audit 'granted' via branch ingestion
    db.add(
        AuditLog(
            id=str(uuid4()),
            consent_id=consent.id,
            action="granted",
            actor=payload.branch_officer_id,  # so audit shows *who* initiated it

            product_id=consent.product_id,
            purpose=consent.purpose,
            source_channel=getattr(consent, "source_channel", None),
            actor_type=getattr(consent, "actor_type", None),
            application_number=getattr(consent, "application_number", None),
            mobile_number=getattr(consent, "mobile_number", None),
            evidence_ref=getattr(consent, "evidence_ref", None),

            details=payload.meta,
        )
    )

    otp_txn.consent_id = consent.id
    db.add(otp_txn)

    db.commit()
    db.refresh(consent)

    return _row_to_out(consent)
