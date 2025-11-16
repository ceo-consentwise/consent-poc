# backend/app/seed_consent_templates_v2.py

from uuid import uuid4

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ConsentTemplate

TENANT_ID = "DEMO_BANK"
PRODUCT_ID = "LOAN"
PURPOSE = "marketing"
TEMPLATE_TYPE = "processing"


def seed_v2(db: Session) -> None:
    """
    Seed a single v2 template for:
    DEMO_BANK / LOAN / marketing / processing.

    This does NOT touch v1; it creates a new row with version=2
    if it doesn't already exist.
    """

    # Check if v2 already exists for this combination
    existing_v2 = (
        db.query(ConsentTemplate)
        .filter(ConsentTemplate.tenant_id == TENANT_ID)
        .filter(ConsentTemplate.product_id == PRODUCT_ID)
        .filter(ConsentTemplate.purpose == PURPOSE)
        .filter(ConsentTemplate.template_type == TEMPLATE_TYPE)
        .filter(ConsentTemplate.version == 2)
        .first()
    )

    if existing_v2:
        print("v2 template already exists, skipping.")
        return

    # Optional: fetch v1 to reuse / adapt its text
    base_v1 = (
        db.query(ConsentTemplate)
        .filter(ConsentTemplate.tenant_id == TENANT_ID)
        .filter(ConsentTemplate.product_id == PRODUCT_ID)
        .filter(ConsentTemplate.purpose == PURPOSE)
        .filter(ConsentTemplate.template_type == TEMPLATE_TYPE)
        .filter(ConsentTemplate.version == 1)
        .first()
    )

    if base_v1:
        title = base_v1.title or "LOAN - Marketing consent (processing) v2"
        body_text = (
            base_v1.body_text
            + " This is the updated version of the consent text (v2), "
              "with clarified marketing usage and retention details."
        )
    else:
        # Fallback if v1 not found for some reason
        title = "LOAN - Marketing consent (processing) v2"
        body_text = (
            "I consent to DEMO_BANK processing my personal data in relation "
            "to the LOAN product for marketing purposes (v2). "
            "This is an updated consent wording."
        )

    tmpl_v2 = ConsentTemplate(
        id=str(uuid4()),
        tenant_id=TENANT_ID,
        product_id=PRODUCT_ID,
        purpose=PURPOSE,
        template_type=TEMPLATE_TYPE,
        version=2,
        title=title,
        body_text=body_text,
        is_active=True,
    )

    # Optionally deactivate v1 (this is typical BFSI behavior)
    if base_v1 and base_v1.is_active:
        base_v1.is_active = False
        db.add(base_v1)

    db.add(tmpl_v2)
    db.commit()
    print("Created v2 template for DEMO_BANK / LOAN / marketing / processing.")


def main() -> None:
    db = SessionLocal()
    try:
        seed_v2(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
