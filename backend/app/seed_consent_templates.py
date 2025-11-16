# backend/app/seed_consent_templates.py

from uuid import uuid4
from typing import List, Dict

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ConsentTemplate


DEFAULT_TENANT_ID = "DEMO_BANK"
DEFAULT_TEMPLATE_TYPE = "processing"


def _base_templates() -> List[Dict]:
    """
    Define initial v1 templates for DEMO_BANK.
    For now we seed only template_type='processing' because
    our backend logic defaults to that. Later we can add
    onboarding/sharing/confirmation variants.
    """
    products = ["LOAN", "CASA", "CARD", "INSURANCE"]
    purposes = ["regulatory", "service", "marketing"]

    templates: List[Dict] = []

    for product in products:
        for purpose in purposes:
            # Simple title/body; you can refine text later
            title = f"{product} - {purpose.capitalize()} consent (processing)"
            body_text = (
                f"I consent to {DEFAULT_TENANT_ID} processing my personal data "
                f"in relation to the {product} product for {purpose} purposes. "
                "I understand that my data will be processed in accordance with "
                "applicable regulations and the bank's privacy policy."
            )

            templates.append(
                {
                    "tenant_id": DEFAULT_TENANT_ID,
                    "product_id": product,
                    "purpose": purpose,
                    "template_type": DEFAULT_TEMPLATE_TYPE,
                    "version": 1,
                    "title": title,
                    "body_text": body_text,
                }
            )

    return templates


def seed_consent_templates(db: Session) -> None:
    """
    Seed initial v1 consent templates for DEMO_BANK.
    This function is idempotent: if a (tenant, product, purpose,
    template_type, version=1) already exists, it will be skipped.
    """
    templates = _base_templates()

    created = 0
    skipped = 0

    for tpl in templates:
        existing = (
            db.query(ConsentTemplate)
            .filter(ConsentTemplate.tenant_id == tpl["tenant_id"])
            .filter(ConsentTemplate.product_id == tpl["product_id"])
            .filter(ConsentTemplate.purpose == tpl["purpose"])
            .filter(ConsentTemplate.template_type == tpl["template_type"])
            .filter(ConsentTemplate.version == tpl["version"])
            .first()
        )

        if existing:
            print(
                f"Skipping existing template: "
                f"{tpl['tenant_id']} / {tpl['product_id']} / "
                f"{tpl['purpose']} / {tpl['template_type']} v{tpl['version']}"
            )
            skipped += 1
            continue

        tmpl = ConsentTemplate(
            id=str(uuid4()),
            tenant_id=tpl["tenant_id"],
            product_id=tpl["product_id"],
            purpose=tpl["purpose"],
            template_type=tpl["template_type"],
            version=tpl["version"],
            title=tpl["title"],
            body_text=tpl["body_text"],
            is_active=True,
        )

        db.add(tmpl)
        created += 1

    db.commit()
    print(f"Seed complete. Created={created}, Skipped={skipped}")


def main() -> None:
    db = SessionLocal()
    try:
        seed_consent_templates(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
