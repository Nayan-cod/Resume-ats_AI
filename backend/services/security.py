"""
Security service: symmetric encryption/decryption of sensitive values (e.g., SMTP passwords)
using the Fernet (AES-256-CBC + HMAC) scheme from the cryptography library.
"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

# Read SMTP_ENCRYPTION_KEY from env, or derive a stable fallback key from JWT_SECRET.
# The derived key is deterministic so previously encrypted values remain decryptable across restarts.
encryption_key = os.getenv("SMTP_ENCRYPTION_KEY")
if not encryption_key:
    secret = os.getenv("JWT_SECRET", "ats_super_secret_key_2026_change_in_production")
    key_bytes = hashlib.sha256(secret.encode()).digest()
    encryption_key = base64.urlsafe_b64encode(key_bytes).decode()
    print(
        "WARNING: SMTP_ENCRYPTION_KEY is not configured in .env. "
        "Derived a stable fallback key from JWT_SECRET. "
        "Set SMTP_ENCRYPTION_KEY explicitly in production."
    )

fernet = Fernet(encryption_key.encode())


def encrypt_password(plain_text: str) -> str:
    """
    Encrypt a plain-text string using Fernet AES-256 symmetric encryption.

    @param plain_text: The raw string to encrypt (e.g., an SMTP app password).
    @returns: URL-safe base64-encoded ciphertext string, or empty string if input is empty.
    """
    if not plain_text:
        return ""
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_password(cipher_text: str) -> str:
    """
    Decrypt a Fernet-encrypted ciphertext string back to plain text.

    @param cipher_text: The encrypted string previously produced by encrypt_password().
    @returns: The original plain-text string, or empty string if input is empty.
    @raises ValueError: If the cipher_text is corrupted, tampered with, or encrypted with a different key.
    """
    if not cipher_text:
        return ""
    try:
        return fernet.decrypt(cipher_text.encode()).decode()
    except InvalidToken as exc:
        # This typically means the encryption key has changed or the ciphertext is corrupted.
        # Re-raise as ValueError so callers can handle it without importing cryptography internals.
        raise ValueError(
            "Failed to decrypt stored SMTP password. The encryption key may have changed. "
            "Please re-save your SMTP settings in the dashboard."
        ) from exc
