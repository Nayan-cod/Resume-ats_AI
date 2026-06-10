"""
Authentication service: password hashing, JWT creation/decoding, and FastAPI dependencies.
"""
import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, Request
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "ats_super_secret_key_2026_change_in_production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = 24

# Warn at startup if the JWT secret is still the insecure default value
_DEFAULT_SECRET = "ats_super_secret_key_2026_change_in_production"
if JWT_SECRET == _DEFAULT_SECRET:
    print(
        "WARNING: JWT_SECRET is set to the default insecure value. "
        "Set a strong random secret in your .env or environment variables before deploying to production."
    )


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt with a random salt.

    @param password: The plain-text password string to hash.
    @returns: The bcrypt-hashed password as a UTF-8 string.
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a plain-text password against a stored bcrypt hash.

    @param password: The plain-text password to verify.
    @param hashed: The stored bcrypt hash to compare against.
    @returns: True if the password matches the hash, False otherwise.
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: int, email: str, role: str) -> str:
    """
    Create a signed JWT token for the given user.

    @param user_id: The user's database primary key.
    @param email: The user's email address (included in payload for convenience).
    @param role: The user's role ('hr' or 'candidate').
    @returns: A signed JWT string valid for JWT_EXPIRY_HOURS hours.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and verify a JWT token, raising HTTPException on failure.

    @param token: The raw JWT string from the Authorization header.
    @returns: The decoded payload dict (user_id, email, role, exp).
    @raises HTTPException 401: If the token is expired or invalid.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")


def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that extracts and validates the current user from the Authorization header.

    @param request: The incoming HTTP request.
    @returns: Decoded JWT payload dict with user_id, email, and role.
    @raises HTTPException 401: If the Authorization header is missing, malformed, or token is invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header.")

    token = auth_header.split(" ")[1]
    return decode_token(token)


def require_role(role: str):
    """
    FastAPI dependency factory that enforces a specific role for an endpoint.

    @param role: The required role string ('hr' or 'candidate').
    @returns: A dependency callable that validates the current user's role.
    @raises HTTPException 403: If the authenticated user's role does not match.
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") != role:
            raise HTTPException(status_code=403, detail=f"Access denied. Requires '{role}' role.")
        return current_user
    return role_checker
