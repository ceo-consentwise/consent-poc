# --- Base ---
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata sqlite3 && rm -rf /var/lib/apt/lists/*

# Install deps first (cache-friendly)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY app /app/app
COPY alembic.ini /app/alembic.ini
COPY migrations /app/migrations

EXPOSE 8000

# Run migrations each start, then launch API with reload (dev)
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload