"""
Job-posting routes: list, create (HR), HR-specific jobs.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator

from services import database, auth

router = APIRouter(prefix="/api", tags=["jobs"])


class CreateJobRequest(BaseModel):
    title: str
    description: str

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Strip whitespace and enforce title length limits."""
        v = v.strip()
        if not v:
            raise ValueError("Job title is required.")
        if len(v) > 300:
            raise ValueError("Job title is too long (max 300 characters).")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        """Strip whitespace and enforce description length limits."""
        v = v.strip()
        if not v:
            raise ValueError("Job description is required.")
        if len(v) > 20000:
            raise ValueError("Job description is too long (max 20,000 characters).")
        return v


def _serialize_job(job: dict) -> dict:
    """Convert datetime fields to strings for JSON serialisation."""
    if job.get("created_at"):
        job["created_at"] = str(job["created_at"])
    return job


@router.get("/jobs")
async def get_all_jobs():
    """
    Return all public job postings, sorted by newest first.

    @returns: List of job dicts with title, description, hr_name, and application_count.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return [_serialize_job(j) for j in database.get_all_jobs()]
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to fetch all jobs: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load job postings. Please try again.")


@router.post("/jobs")
async def create_job(
    req: CreateJobRequest,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """
    Create a new job posting (HR only).

    @param req: CreateJobRequest with title and description.
    @param current_user: Injected HR user from auth dependency.
    @returns: The newly created job dict.
    @raises HTTPException 422: If title or description fail validation.
    @raises HTTPException 500: If the database insert fails.
    """
    try:
        job = _serialize_job(database.create_job(req.title, req.description, current_user["user_id"]))
        return job
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to create job for HR {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create job posting. Please try again.")


@router.get("/hr/jobs")
async def get_hr_jobs(current_user: dict = Depends(auth.require_role("hr"))):
    """
    Return all jobs posted by the currently authenticated HR user.

    @param current_user: Injected HR user from auth dependency.
    @returns: List of job dicts owned by this HR, with application_count.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return [_serialize_job(j) for j in database.get_jobs_by_hr(current_user["user_id"])]
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to fetch HR jobs for user {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load your job postings.")


@router.get("/hr/stats")
async def get_hr_stats(current_user: dict = Depends(auth.require_role("hr"))):
    """
    Return dashboard summary statistics for the logged-in HR user.

    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with total_jobs, total_applications, shortlisted, approved, rejected counts.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return database.get_hr_stats(current_user["user_id"])
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to fetch stats for HR {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard statistics.")


@router.get("/hr/analytics")
async def get_hr_analytics(current_user: dict = Depends(auth.require_role("hr"))):
    """
    Return full analytics data for the logged-in HR user's recruitment pipeline.

    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with stats, pipeline, timeline, and skills breakdown.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return database.get_hr_analytics(current_user["user_id"])
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to fetch analytics for HR {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load analytics data.")


@router.get("/public-stats")
async def get_public_stats():
    """
    Return platform-wide public statistics shown on the landing page.

    @returns: Dict with total_candidates, total_hrs, total_jobs, total_selected.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return database.get_public_stats()
    except Exception as exc:
        print(f"[JOBS ERROR] Failed to fetch public stats: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load platform statistics.")
