"""
Authentication routes: register, login, get-me.
"""
import re
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator

from services import database, auth

router = APIRouter(prefix="/api", tags=["auth"])

# Simple RFC-5322-inspired email regex — lightweight and avoids heavy deps
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str  # 'hr' or 'candidate'

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Normalise and validate email format."""
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address format.")
        if len(v) > 254:
            raise ValueError("Email address is too long (max 254 characters).")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Enforce minimum password length."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v) > 128:
            raise ValueError("Password is too long (max 128 characters).")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Strip whitespace and enforce name length."""
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        if len(v) > 100:
            raise ValueError("Name is too long (max 100 characters).")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        """Normalise email to lowercase and strip whitespace before lookup."""
        return v.strip().lower()


@router.post("/register")
async def register(req: RegisterRequest):
    """
    Register a new user (HR or Candidate).

    @param req: RegisterRequest with email, password, name, and role.
    @returns: Dict containing the JWT token and sanitised user object.
    @raises HTTPException 400: If role is invalid.
    @raises HTTPException 409: If email is already registered.
    @raises HTTPException 422: If validation fails (email format, password length, etc.).
    """
    if req.role not in ("hr", "candidate"):
        raise HTTPException(status_code=400, detail="Role must be 'hr' or 'candidate'.")

    if database.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    try:
        password_hash = auth.hash_password(req.password)
        user = database.create_user(req.email, password_hash, req.name, req.role)
        token = auth.create_token(user["id"], user["email"], user["role"])
    except Exception as exc:
        print(f"[AUTH ERROR] Registration failed for {req.email}: {exc}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

    return {"token": token, "user": user}


@router.post("/login")
async def login(req: LoginRequest, request: Request):
    """
    Authenticate a user and return a JWT token.

    @param req: LoginRequest with email and password.
    @param request: The incoming HTTP request (used to extract IP and user-agent for audit logging).
    @returns: Dict containing the JWT token and sanitised user object (no password hash).
    @raises HTTPException 401: If credentials are invalid.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = database.get_user_by_email(req.email)
    if not user:
        # Log failed attempt before raising — intentionally vague message to prevent email enumeration
        database.log_login_attempt(req.email, "failed", ip_address=ip_address, user_agent=user_agent)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not auth.verify_password(req.password, user["password_hash"]):
        database.log_login_attempt(req.email, "failed", user_id=user["id"], ip_address=ip_address, user_agent=user_agent)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    try:
        token = auth.create_token(user["id"], user["email"], user["role"])
    except Exception as exc:
        print(f"[AUTH ERROR] Token creation failed for user {user['id']}: {exc}")
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")

    database.log_login_attempt(req.email, "success", user_id=user["id"], ip_address=ip_address, user_agent=user_agent)

    # Return only safe user fields — never expose password_hash
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
    """
    Retrieve the currently authenticated user's profile.

    @param current_user: Injected by the auth dependency from the Bearer token.
    @returns: Sanitised user dict (id, email, name, role).
    @raises HTTPException 404: If the user record no longer exists in DB.
    """
    user = database.get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    return user
