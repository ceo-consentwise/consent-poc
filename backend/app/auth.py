# backend/app/auth.py
# Simple, dependency-free “JWT-like” token using HMAC-SHA256.
# PoC only. Do NOT use as-is for production.

import base64, json, hmac, hashlib, time
from typing import Optional

SECRET = "change-this-dev-secret"  # put in .env for real apps
TOKEN_TTL_SECONDS = 24 * 3600

# In-memory user store for PoC
_USERS = {
    "operator": {
        "password": "op123",   # PLAIN for PoC (no bcrypt to avoid Windows issues)
        "role": "operator",
    },
}

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64url_json(obj: dict) -> str:
    return _b64url(json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))

def _sign(msg: str) -> str:
    sig = hmac.new(SECRET.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).digest()
    return _b64url(sig)

def create_token(username: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": username, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    h = _b64url_json(header)
    p = _b64url_json(payload)
    s = _sign(f"{h}.{p}")
    return f"{h}.{p}.{s}"

def decode_token(token: str) -> str:
    """Returns username if valid; raises ValueError if invalid/expired."""
    try:
        h, p, s = token.split(".")
    except Exception:
        raise ValueError("Malformed token")

    expected = _sign(f"{h}.{p}")
    if not hmac.compare_digest(expected, s):
        raise ValueError("Invalid signature")

    payload = json.loads(base64.urlsafe_b64decode(p + "=="))
    exp = int(payload.get("exp", 0))
    if int(time.time()) >= exp:
        raise ValueError("Token expired")
    username = payload.get("sub")
    if not username:
        raise ValueError("Invalid payload")
    return username

def verify_credentials(username: str, password: str) -> Optional[dict]:
    user = _ USERS.get(username) if False else _USERS.get(username)  # keeps linter calm
    if user and hmac.compare_digest(password, user["password"]):
        return {"username": username, "role": user.get("role", "operator")}
    return None
