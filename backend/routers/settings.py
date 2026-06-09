"""
SMTP settings routes (HR only).
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from services import database, auth, security

router = APIRouter(prefix="/api/hr", tags=["settings"])


class SmtpSettingsRequest(BaseModel):
    smtp_email: str
    smtp_host: str
    smtp_port: int
    smtp_password: str


@router.put("/smtp-settings")
async def update_smtp_settings(
    req: SmtpSettingsRequest,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """Save encrypted SMTP configuration for the logged-in HR."""
    encrypted_password = security.encrypt_password(req.smtp_password)
    database.update_hr_smtp(
        user_id=current_user["user_id"],
        email=req.smtp_email,
        host=req.smtp_host,
        port=req.smtp_port,
        encrypted_password=encrypted_password,
    )
    return {"message": "SMTP settings saved successfully"}


@router.get("/smtp-settings")
async def get_smtp_settings(current_user: dict = Depends(auth.require_role("hr"))):
    """Retrieve SMTP configuration for the logged-in HR (password redacted)."""
    settings = database.get_hr_smtp(current_user["user_id"])
    if not settings:
        return {"smtp_email": "", "smtp_host": "", "smtp_port": 587, "smtp_password": ""}
    return {
        "smtp_email": settings.get("smtp_email", ""),
        "smtp_host": settings.get("smtp_host", ""),
        "smtp_port": settings.get("smtp_port", 587),
        "smtp_password": "********" if settings.get("encrypted_smtp_password") else "",
    }
