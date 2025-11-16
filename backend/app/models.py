from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Boolean,
)
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class Consent(Base):
    __tablename__ = "consents"

    # Primary key – STRING (UUID)
    id = Column(String, primary_key=True, index=True)

    # Core consent fields
    subject_id = Column(String, nullable=True)        # CIF / application / customer id
    purpose = Column(String, nullable=True)           # we store data_use_case/purpose here
    status = Column(String, nullable=False, default="granted")
    source = Column(String, nullable=True)            # web_form, web_ingestion_customer, etc.
    meta = Column(JSON, nullable=True)

    # BFSI context (all nullable)
    tenant_id = Column(String, nullable=True)         # DEMO_BANK, etc.
    product_id = Column(String, nullable=True)        # LOAN, CASA, CARD, INSURANCE

    source_channel = Column(String, nullable=True)    # web_app_customer, web_app_branch_officer
    actor_type = Column(String, nullable=True)        # customer, branch_officer

    application_number = Column(String, nullable=True)
    mobile_number = Column(String, nullable=True)

    # Versioning & evidence
    version = Column(Integer, nullable=True)          # template version (1,2,...)
    evidence_ref = Column(String, nullable=True)      # OTP transaction id, call ref, etc.

    template_id = Column(String, ForeignKey("consent_templates.id"), nullable=True)
    previous_consent_id = Column(String, ForeignKey("consents.id"), nullable=True)

    created_at = Column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)

    consent_id = Column(String, ForeignKey("consents.id"), nullable=False)

    action = Column(String, nullable=False)          # granted, revoked, renewed, etc.
    actor = Column(String, nullable=True)            # web_form, customer_ingestion, branch_officer_id

    # BFSI snapshot at time of event
    product_id = Column(String, nullable=True)
    purpose = Column(String, nullable=True)
    source_channel = Column(String, nullable=True)
    actor_type = Column(String, nullable=True)
    application_number = Column(String, nullable=True)
    mobile_number = Column(String, nullable=True)
    evidence_ref = Column(String, nullable=True)

    details = Column(JSON, nullable=True)

    timestamp = Column(
        DateTime, nullable=False, server_default=func.now()
    )


class ConsentTemplate(Base):
    __tablename__ = "consent_templates"

    id = Column(String, primary_key=True, index=True)

    tenant_id = Column(String, nullable=False)        # DEMO_BANK
    product_id = Column(String, nullable=False)       # LOAN/CASA/CARD/INSURANCE
    purpose = Column(String, nullable=False)          # regulatory/service/marketing
    template_type = Column(String, nullable=False)    # onboarding/processing/sharing/confirmation

    version = Column(Integer, nullable=False)         # 1,2,3,...

    title = Column(String, nullable=True)
    body_text = Column(String, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime, nullable=False, server_default=func.now()
    )


class OtpTransaction(Base):
    __tablename__ = "otp_transactions"

    id = Column(Integer, primary_key=True, index=True)

    transaction_id = Column(String, unique=True, nullable=False, index=True)

    mobile_number = Column(String, nullable=False)
    channel = Column(String, nullable=False)          # customer_login, branch_consent
    application_number = Column(String, nullable=True)

    otp_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Link to Consent AFTER consent creation (string FK)
    consent_id = Column(String, ForeignKey("consents.id"), nullable=True)
