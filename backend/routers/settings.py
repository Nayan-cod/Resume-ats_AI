"""
SMTP settings routes (HR only).
Allows each HR to configure their own outbound mail server for candidate decision emails.
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from services import database, auth, security

router = APIRouter(prefix="/api/hr", tags=["settings"])

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


class SmtpSettingsRequest(BaseModel):
    smtp_email: str
    smtp_host: str
    smtp_port: int
    smtp_password: str

    @field_validator("smtp_email")
    @classmethod
    def validate_smtp_email(cls, v: str) -> str:
        """Validate that the SMTP sender email is a well-formed address."""
        v = v.strip()
        if not v:
            raise ValueError("SMTP email is required.")
        if not _EMAIL_RE.match(v):
            raise ValueError("SMTP email must be a valid email address.")
        if len(v) > 254:
            raise ValueError("SMTP email is too long (max 254 characters).")
        return v

    @field_validator("smtp_host")
    @classmethod
    def validate_smtp_host(cls, v: str) -> str:
        """Strip and validate the SMTP host length."""
        v = v.strip()
        if not v:
            raise ValueError("SMTP host is required.")
        if len(v) > 253:
            raise ValueError("SMTP host is too long (max 253 characters).")
        return v

    @field_validator("smtp_port")
    @classmethod
    def validate_smtp_port(cls, v: int) -> int:
        """Ensure the port number is within valid TCP range."""
        if not (1 <= v <= 65535):
            raise ValueError("SMTP port must be between 1 and 65535.")
        return v

    @field_validator("smtp_password")
    @classmethod
    def validate_smtp_password(cls, v: str) -> str:
        """Enforce maximum length on the SMTP password to prevent storage abuse."""
        if len(v) > 500:
            raise ValueError("SMTP password is too long (max 500 characters).")
        return v


@router.put("/smtp-settings")
async def update_smtp_settings(
    req: SmtpSettingsRequest,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """
    Save encrypted SMTP configuration for the logged-in HR user.
    The password is AES-256 encrypted via Fernet before storage.

    @param req: SmtpSettingsRequest with host, port, email, and password.
    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with a success message.
    @raises HTTPException 422: If any field fails validation.
    @raises HTTPException 500: If encryption or DB update fails.
    """
    try:
        encrypted_password = security.encrypt_password(req.smtp_password)
        database.update_hr_smtp(
            user_id=current_user["user_id"],
            email=req.smtp_email,
            host=req.smtp_host,
            port=req.smtp_port,
            encrypted_password=encrypted_password,
        )
    except Exception as exc:
        print(f"[SETTINGS ERROR] Failed to save SMTP for HR {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save SMTP settings. Please try again.")

    return {"message": "SMTP settings saved successfully."}


@router.get("/smtp-settings")
async def get_smtp_settings(current_user: dict = Depends(auth.require_role("hr"))):
    """
    Retrieve SMTP configuration for the logged-in HR user.
    The password is always redacted in the response — it is never returned in plaintext.

    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with smtp_email, smtp_host, smtp_port, and a redacted smtp_password indicator.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        settings = database.get_hr_smtp(current_user["user_id"])
    except Exception as exc:
        print(f"[SETTINGS ERROR] Failed to fetch SMTP for HR {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load SMTP settings.")

    if not settings:
        # Return empty defaults so the frontend form populates gracefully
        return {"smtp_email": "", "smtp_host": "", "smtp_port": 587, "smtp_password": ""}

    return {
        "smtp_email": settings.get("smtp_email", ""),
        "smtp_host": settings.get("smtp_host", ""),
        "smtp_port": settings.get("smtp_port", 587),
        # Never return the plaintext or encrypted password — only indicate whether one is set
        "smtp_password": "********" if settings.get("encrypted_smtp_password") else "",
    }
