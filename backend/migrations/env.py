from __future__ import annotations
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

# --- Import app metadata so Alembic "sees" tables ---
from app.database import Base, DATABASE_URL
import app.models  # <-- CRITICAL: registers models on Base.metadata

# this is the Alembic Config object
config = context.config

# If you prefer to ignore alembic.ini URL, force DATABASE_URL here:
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = create_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
        connect_args={"check_same_thread": False},  # for SQLite
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
