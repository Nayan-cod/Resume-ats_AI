"""
Job-posting routes: list, create (HR), HR-specific jobs.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services import database, auth

router = APIRouter(prefix="/api", tags=["jobs"])


class CreateJobRequest(BaseModel):
    title: str
    description: str


def _serialize_job(job: dict) -> dict:
    """Convert datetime fields to strings for JSON serialisation."""
    if job.get("created_at"):
        job["created_at"] = str(job["created_at"])
    return job


@router.get("/jobs")
async def get_all_jobs():
    """Return all public job postings."""
    return [_serialize_job(j) for j in database.get_all_jobs()]


@router.post("/jobs")
async def create_job(
    req: CreateJobRequest,
    current_user: dict = Depends(auth.require_role("hr")),
    ws_manager=Depends(lambda: None),
):
    """Create a job posting (HR only)."""
    job = _serialize_job(database.create_job(req.title, req.description, current_user["user_id"]))
    return job


@router.get("/hr/jobs")
async def get_hr_jobs(current_user: dict = Depends(auth.require_role("hr"))):
    """Return jobs posted by the logged-in HR."""
    return [_serialize_job(j) for j in database.get_jobs_by_hr(current_user["user_id"])]


@router.get("/hr/stats")
async def get_hr_stats(current_user: dict = Depends(auth.require_role("hr"))):
    """Return dashboard statistics for the logged-in HR."""
    return database.get_hr_stats(current_user["user_id"])


@router.get("/hr/analytics")
async def get_hr_analytics(current_user: dict = Depends(auth.require_role("hr"))):
    """Return dashboard analytics for the logged-in HR."""
    return database.get_hr_analytics(current_user["user_id"])



@router.get("/public-stats")
async def get_public_stats():
    """Return platform-wide public statistics."""
    return database.get_public_stats()
