# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse

# Import API routers (unchanged)
from app.api.v1.routes_consent import router as consent_router
from app.api.v1.routes_audit import router as audit_router

app = FastAPI(
    title="Consent Management PoC",
    version="1.0.0",
    description="Minimal consent + audit + CSV export API for demo purposes."
)

# CORS: allow Vite dev and same-origin (adjust if you host frontend elsewhere)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",  # keep permissive for the PoC; tighten later
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include existing API routers under /api/v1 (UNCHANGED)
app.include_router(consent_router, prefix="/api/v1", tags=["consent"])
app.include_router(audit_router,   prefix="/api/v1", tags=["audit"])

# --- New: friendly root page for Render ---
@app.get("/", response_class=HTMLResponse)
def root():
    return """
    <html>
      <head><title>Consent PoC API</title></head>
      <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px;">
        <h2>Consent Management PoC API</h2>
        <p>This service is live. Use the interactive API docs:</p>
        <p><a href="/docs">/docs</a> (Swagger UI)</p>
        <hr/>
        <p>Key endpoints:</p>
        <ul>
          <li>POST /api/v1/consents &mdash; grant consent</li>
          <li>PATCH /api/v1/consents/{id}/revoke &mdash; revoke</li>
          <li>GET /api/v1/consents &mdash; list</li>
          <li>GET /api/v1/audit &mdash; audit events</li>
          <li>GET /api/v1/consents/export.csv &mdash; CSV export</li>
          <li>GET /api/v1/audit/export.csv &mdash; CSV export</li>
        </ul>
        <p>Health: <a href="/healthz">/healthz</a></p>
      </body>
    </html>
    """

# --- New: simple healthcheck ---
@app.get("/healthz", response_class=JSONResponse)
def healthz():
    return {"status": "ok"}
