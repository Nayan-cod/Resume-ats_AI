import os
import base64
import hashlib
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# Read SMTP_ENCRYPTION_KEY from env, or derive a stable fallback key from JWT_SECRET
encryption_key = os.getenv("SMTP_ENCRYPTION_KEY")
if not encryption_key:
    secret = os.getenv("JWT_SECRET", "ats_super_secret_key_2026_change_in_production")
    # Derive a valid 32-byte Fernet key from the secret
    key_bytes = hashlib.sha256(secret.encode()).digest()
    encryption_key = base64.urlsafe_b64encode(key_bytes).decode()
    print("WARNING: SMTP_ENCRYPTION_KEY is not configured in .env. Derived stable fallback key from JWT_SECRET.")

fernet = Fernet(encryption_key.encode())

def encrypt_password(plain_text: str) -> str:
    """Encrypt a plain text password using Fernet AES-256."""
    if not plain_text:
        return ""
    return fernet.encrypt(plain_text.encode()).decode()

def decrypt_password(cipher_text: str) -> str:
    """Decrypt a Fernet AES-256 encrypted password."""
    if not cipher_text:
        return ""
    return fernet.decrypt(cipher_text.encode()).decode()
