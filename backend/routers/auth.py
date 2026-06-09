"""
Authentication routes: register, login, get-me.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from services import database, auth

router = APIRouter(prefix="/api", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str  # 'hr' or 'candidate'


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest, ws_manager=Depends(lambda: None)):
    """Register a new user (HR or Candidate)."""
    if req.role not in ("hr", "candidate"):
        raise HTTPException(status_code=400, detail="Role must be 'hr' or 'candidate'")

    if database.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = auth.hash_password(req.password)
    user = database.create_user(req.email, password_hash, req.name, req.role)
    token = auth.create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": user}


@router.post("/login")
async def login(req: LoginRequest, request: Request):
    """Login and return a JWT token."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = database.get_user_by_email(req.email)
    if not user:
        database.log_login_attempt(req.email, "failed", ip_address=ip_address, user_agent=user_agent)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not auth.verify_password(req.password, user["password_hash"]):
        database.log_login_attempt(req.email, "failed", user_id=user["id"], ip_address=ip_address, user_agent=user_agent)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_token(user["id"], user["email"], user["role"])
    database.log_login_attempt(req.email, "success", user_id=user["id"], ip_address=ip_address, user_agent=user_agent)

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(auth.get_current_user)):
    """Get current user from token."""
    user = database.get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
