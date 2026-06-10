import os
import re
import boto3
from botocore.config import Config

ENDPOINT_URL = os.getenv("SUPABASE_S3_ENDPOINT")
ACCESS_KEY_ID = os.getenv("SUPABASE_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.getenv("SUPABASE_SECRET_ACCESS_KEY")
BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "resumes")

# Initialize client if keys are present
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
    Uploads a PDF file to the Supabase Storage Bucket.
    Returns the public URL of the uploaded file.
    """
    if not s3_client:
        raise ValueError("Supabase storage client is not configured. Check environment variables.")
    
    # Upload file to the bucket with PDF content type
    s3_client.upload_file(
        local_path,
        BUCKET_NAME,
        filename,
        ExtraArgs={"ContentType": "application/pdf"}
    )

    # Construct public URL
    # e.g., endpoint: https://gnbjsvhyguwypprxbadh.storage.supabase.co/storage/v1/s3
    # we want: https://gnbjsvhyguwypprxbadh.supabase.co/storage/v1/object/public/resumes/filename
    match = re.match(r"(https://[a-zA-Z0-9\-]+)\.storage\.supabase\.co", ENDPOINT_URL)
    if match:
        base_url = match.group(1) + ".supabase.co"
    else:
        base_url = ENDPOINT_URL.replace("/storage/v1/s3", "")
        
    public_url = f"{base_url}/storage/v1/object/public/{BUCKET_NAME}/{filename}"
    return public_url

def delete_resume(filename: str) -> bool:
    """
    Deletes a file from the Supabase Storage Bucket.
    Returns True if successful, False otherwise.
    """
    if not s3_client:
        raise ValueError("Supabase storage client is not configured. Check environment variables.")
    
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=filename)
        return True
    except Exception as e:
        print(f"[STORAGE ERROR] Failed to delete {filename} from Supabase: {e}")
        return False
