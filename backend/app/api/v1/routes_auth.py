# backend/app/api/v1/routes_auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.auth import verify_credentials, create_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginIn(BaseModel):
    username: str
    password: str

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/login", response_model=LoginOut, summary="Login (PoC)")
def login(payload: LoginIn):
    user = verify_credentials(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_token(user["username"])
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", summary="Who am I?")
def me(username: str = Depends(get_current_user)):
    return {"username": username}
