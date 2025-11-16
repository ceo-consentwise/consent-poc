# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_v1
from .database import engine
from . import models


app = FastAPI(title="Consent PoC API", version="0.1")
# Ensure all tables are created on startup (PoC-friendly)
models.Base.metadata.create_all(bind=engine)


# CORS for local dev
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://consent-poc-1.onrender.com",   # Render frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

# Mount all v1 routes
app.include_router(api_v1)
