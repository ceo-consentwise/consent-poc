from fastapi import FastAPI

app = FastAPI(
    title="Consent Management PoC API",
    version="0.1.0",
    description="Proof-of-concept for managing user consent (grant, revoke, audit)."
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Hello from Consent PoC API!"}