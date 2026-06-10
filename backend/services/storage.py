"""
Storage service: uploads and deletes resume PDF files from Supabase S3-compatible storage.

[ACTION NEEDED]: Ensure the Supabase bucket is configured with 'Private' access policy
and that all file access URLs are served over HTTPS only. Never use HTTP for file URLs in production.
"""
import os
import re
import boto3
from botocore.config import Config

ENDPOINT_URL = os.getenv("SUPABASE_S3_ENDPOINT")
ACCESS_KEY_ID = os.getenv("SUPABASE_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.getenv("SUPABASE_SECRET_ACCESS_KEY")
BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "resumes")

# Allowed file extension for resume uploads
_ALLOWED_EXTENSION = ".pdf"

# Initialise S3 client only if all required environment variables are present
s3_client = None
if ENDPOINT_URL and ACCESS_KEY_ID and SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        "s3",
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name=os.getenv("AWS_REGION", "ap-south-1"),
        config=Config(signature_version="s3v4")
    )


def upload_resume(local_path: str, filename: str) -> str:
    """
    Upload a PDF resume file to the configured Supabase Storage bucket.

    @param local_path: Absolute path to the local file to upload.
    @param filename: The target filename/key to use in the storage bucket.
    @returns: The public HTTPS URL of the uploaded file.
    @raises ValueError: If the storage client is not configured or the file extension is disallowed.
    @raises Exception: If the S3 upload operation fails.
    """
    if not s3_client:
        raise ValueError(
            "Supabase storage client is not configured. "
            "Set SUPABASE_S3_ENDPOINT, SUPABASE_ACCESS_KEY_ID, and SUPABASE_SECRET_ACCESS_KEY in .env."
        )

    # Validate file extension before upload — only PDFs are permitted
    if not filename.lower().endswith(_ALLOWED_EXTENSION):
        raise ValueError(f"Only {_ALLOWED_EXTENSION} files may be uploaded to storage.")

    s3_client.upload_file(
        local_path,
        BUCKET_NAME,
        filename,
        ExtraArgs={"ContentType": "application/pdf"}
    )

    # Construct the public Supabase URL from the S3 endpoint pattern
    # e.g., endpoint: https://<project>.storage.supabase.co/storage/v1/s3
    # becomes:         https://<project>.supabase.co/storage/v1/object/public/resumes/<filename>
    match = re.match(r"(https://[a-zA-Z0-9\-]+)\.storage\.supabase\.co", ENDPOINT_URL)
    if match:
        base_url = match.group(1) + ".supabase.co"
    else:
        base_url = ENDPOINT_URL.replace("/storage/v1/s3", "")

    public_url = f"{base_url}/storage/v1/object/public/{BUCKET_NAME}/{filename}"
    return public_url


def delete_resume(filename: str) -> bool:
    """
    Delete a resume file from the Supabase Storage bucket by filename key.

    @param filename: The filename/key of the object to delete in the bucket.
    @returns: True if deletion succeeded, False if it failed.
    @raises ValueError: If the storage client is not configured.
    """
    if not s3_client:
        raise ValueError(
            "Supabase storage client is not configured. "
            "Set SUPABASE_S3_ENDPOINT, SUPABASE_ACCESS_KEY_ID, and SUPABASE_SECRET_ACCESS_KEY in .env."
        )

    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=filename)
        return True
    except Exception as e:
        print(f"[STORAGE ERROR] Failed to delete '{filename}' from Supabase: {e}")
        return False
