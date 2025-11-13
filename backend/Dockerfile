# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (optional but helps avoid pip wheels issues)
RUN apt-get update && apt-get install -y build-essential

# Copy backend code
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# Start FastAPI backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
