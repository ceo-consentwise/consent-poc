from sqlalchemy import text, inspect
from app.database import engine


def run_migration():
    print("Starting versioning Step 1 migration...")

    with engine.begin() as conn:
        # 1) Create consent_templates table if it doesn't exist
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS consent_templates (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT,
                    product_id TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    template_type TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    title TEXT,
                    body_text TEXT NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    effective_from DATETIME,
                    effective_to DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )

        # 2) Add columns to consents table if they don't already exist
        inspector = inspect(conn)
        existing_columns = {col["name"] for col in inspector.get_columns("consents")}

        if "template_id" not in existing_columns:
            print("Adding template_id column to consents...")
            conn.execute(text("ALTER TABLE consents ADD COLUMN template_id TEXT"))

        if "previous_consent_id" not in existing_columns:
            print("Adding previous_consent_id column to consents...")
            conn.execute(
                text("ALTER TABLE consents ADD COLUMN previous_consent_id TEXT")
            )

    print("Versioning Step 1 migration completed.")


if __name__ == "__main__":
    run_migration()
