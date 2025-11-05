from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import routes_consent

app = FastAPI(title="Consent Management PoC API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(routes_consent.router, prefix="/api/v1/consents", tags=["consents"])

@app.get("/")
def health():
    return {"status": "ok"}
