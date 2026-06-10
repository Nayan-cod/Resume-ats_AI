"""
Application routes: apply, status update, HR views, candidate views.
The ws_manager dependency is injected by main.py at startup via app.state.
"""
import os
import shutil
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from pydantic import BaseModel, field_validator

from services import database, auth, parser, privacy, matcher, email_service, security, storage

router = APIRouter(prefix="/api", tags=["applications"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
TEMP_DIR = os.getenv("TEMP_DIR", "temp")

# Maximum allowed resume file size: 5 MB
_MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024


class UpdateStatusRequest(BaseModel):
    status: str  # 'approved' or 'rejected'
    email_subject: Optional[str] = None
    email_body: Optional[str] = None

    @field_validator("email_subject")
    @classmethod
    def cap_subject(cls, v: Optional[str]) -> Optional[str]:
        """Cap email subject line to prevent oversized SMTP payloads."""
        if v and len(v) > 300:
            return v[:300]
        return v

    @field_validator("email_body")
    @classmethod
    def cap_body(cls, v: Optional[str]) -> Optional[str]:
        """Cap email body to prevent oversized SMTP payloads."""
        if v and len(v) > 10000:
            return v[:10000]
        return v


def _serialize_app(app: dict) -> dict:
    """Convert datetime fields to strings for JSON serialisation."""
    if app.get("created_at"):
        app["created_at"] = str(app["created_at"])
    return app


def _build_smtp_config(hr_id: int) -> dict | None:
    """
    Load and decrypt the HR's stored SMTP credentials from the database.

    @param hr_id: The HR user's database ID.
    @returns: Dict with smtp_email, smtp_host, smtp_port, smtp_password, or None if not configured.
    """
    try:
        hr_smtp = database.get_hr_smtp(hr_id)
        if not hr_smtp:
            return None
        decrypted_password = security.decrypt_password(hr_smtp["encrypted_smtp_password"])
        return {
            "smtp_email": hr_smtp["smtp_email"],
            "smtp_host": hr_smtp["smtp_host"],
            "smtp_port": hr_smtp["smtp_port"],
            "smtp_password": decrypted_password,
        }
    except Exception as exc:
        print(f"[SMTP CONFIG ERROR] Failed to build SMTP config for HR {hr_id}: {exc}")
        return None


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    request: Request,
    resume_file: UploadFile = File(...),
    current_user: dict = Depends(auth.require_role("candidate")),
):
    """
    Submit a resume application for a specific job (Candidate only).
    Triggers async AI screening after upload and returns immediately.

    @param job_id: The ID of the job being applied to.
    @param request: HTTP request (used to access ws_manager from app.state).
    @param resume_file: The candidate's PDF resume file (max 5 MB).
    @param current_user: Injected candidate user from auth dependency.
    @returns: Dict with success message and the created application record.
    @raises HTTPException 400: If the file is not a PDF or exceeds size limit.
    @raises HTTPException 404: If the job does not exist.
    @raises HTTPException 409: If the candidate already applied to this job.
    @raises HTTPException 500: If storage upload or DB insert fails.
    """
    ws_manager = request.app.state.ws_manager

    # Validate file type — only PDFs accepted
    if not resume_file.filename or not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted. Please upload a .pdf file.")

    # Read file content to check size before saving to disk
    file_content = await resume_file.read()
    if len(file_content) > _MAX_RESUME_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Resume file is too large. Maximum allowed size is 5 MB.")
    # Reset pointer after reading for subsequent copyfileobj calls
    await resume_file.seek(0)

    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    os.makedirs(TEMP_DIR, exist_ok=True)
    safe_filename = f"user{current_user['user_id']}_job{job_id}_{resume_file.filename}"
    temp_path = f"{TEMP_DIR}/{safe_filename}"

    with open(temp_path, "wb") as buf:
        shutil.copyfileobj(resume_file.file, buf)

    try:
        # Upload resume to Supabase Storage
        supabase_url = storage.upload_resume(temp_path, safe_filename)
    except Exception as exc:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to upload resume to storage: {exc}")

    try:
        application = database.create_application(
            job_id=job_id,
            user_id=current_user["user_id"],
            resume_filename=resume_file.filename,
            resume_path=supabase_url,
        )
    except Exception as exc:
        # Roll back storage upload and temp file if DB save fails
        storage.delete_resume(safe_filename)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="You have already applied to this job.")
        raise HTTPException(status_code=500, detail="Failed to save application. Please try again.")

    # AI screening — runs after the response is committed; errors are recorded, not raised
    try:
        try:
            parsed_text = parser.parse_resume(temp_path)
        finally:
            # Delete local temp file immediately after parsing to avoid disk accumulation
            if os.path.exists(temp_path):
                os.remove(temp_path)

        clean_text = privacy.anonymize_text(parsed_text)
        result = await matcher.evaluate_candidate(clean_text, job["description"])

        database.update_application_ai(
            app_id=application["id"],
            score=result.get("score", 0),
            decision=result.get("decision", "Error"),
            justification=json.dumps(result.get("justification", [])),
            candidate_name=result.get("candidate_name", ""),
            candidate_role=result.get("candidate_role", ""),
        )
        await ws_manager.broadcast({
            "type": "new_application",
            "job_id": job_id,
            "message": f"New application received for {job['title']}",
        })
    except Exception as exc:
        print(f"[AI ERROR] Screening failed for application {application['id']}: {exc}")
        # Record the failure state so HR can see the application even if AI failed
        database.update_application_ai(
            app_id=application["id"],
            score=0,
            decision="Error",
            justification=json.dumps([f"AI screening failed. Please review manually."]),
            candidate_name="",
            candidate_role="",
        )

    try:
        stats = database.get_public_stats()
        await ws_manager.broadcast({"type": "stats_update", "stats": stats})
    except Exception as exc:
        print(f"[WS ERROR] Stats broadcast failed: {exc}")

    return {"message": "Application submitted successfully.", "application": _serialize_app(application)}


@router.get("/hr/jobs/{job_id}/applications")
async def get_job_applications(
    job_id: int,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """
    Return all applications for a specific job, sorted by AI score (highest first). HR only.

    @param job_id: The job's database ID.
    @param current_user: Injected HR user from auth dependency.
    @returns: List of application dicts with candidate info, AI scores, and HR status.
    @raises HTTPException 403: If the job belongs to a different HR.
    @raises HTTPException 404: If the job does not exist.
    @raises HTTPException 500: If the database query fails.
    """
    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to view applications for this job.")

    try:
        return [_serialize_app(a) for a in database.get_applications_by_job(job_id)]
    except Exception as exc:
        print(f"[APPS ERROR] Failed to fetch applications for job {job_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load applications.")


@router.patch("/applications/{app_id}/status")
async def update_application_status(
    app_id: int,
    req: UpdateStatusRequest,
    request: Request,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """
    Approve or reject an application and attempt to send a decision email (HR only).
    Uses the HR's configured SMTP settings from the Settings dashboard.

    @param app_id: The application's database ID.
    @param req: UpdateStatusRequest with status ('approved'/'rejected') and optional custom email.
    @param request: HTTP request (used to access ws_manager from app.state).
    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with status message, email_sent flag, and the updated application record.
    @raises HTTPException 400: If status is not 'approved' or 'rejected'.
    @raises HTTPException 403: If the application belongs to a job owned by another HR.
    @raises HTTPException 404: If the application does not exist.
    """
    ws_manager = request.app.state.ws_manager

    if req.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'.")

    app_details = database.get_application_by_id(app_id)
    if not app_details:
        raise HTTPException(status_code=404, detail="Application not found.")

    job = database.get_job_by_id(app_details["job_id"])
    if not job or job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to update this application.")

    # Load HR's SMTP settings from DB (configured in Settings → Email SMTP)
    smtp_config = _build_smtp_config(current_user["user_id"])

    candidate_email = app_details["applicant_email"]
    candidate_name = app_details.get("candidate_name") or app_details.get("applicant_name", "Candidate")
    job_title = app_details.get("job_title", "the position")

    success = False
    email_warning = None

    if not smtp_config:
        # SMTP not configured in the HR dashboard — email cannot be sent
        email_warning = "Email not sent: No SMTP settings configured. Go to Settings → Email SMTP to set up your mail server."
        print(f"[SMTP WARNING] HR {current_user['user_id']} has no SMTP configured — skipping email for app {app_id}.")
    else:
        try:
            if req.email_subject and req.email_body:
                # Use the HR-customised email content from the confirmation modal
                html_content = req.email_body.replace("\n", "<br>")
                header_gradient = (
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    if req.status == "approved"
                    else "linear-gradient(135deg, #6b7280 0%, #374151 100%)"
                )
                header_title = "🎉 Congratulations!" if req.status == "approved" else "Application Update"
                html_body = f"""
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: {header_gradient}; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">{header_title}</h1>
                    </div>
                    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; font-size: 15px; color: #374151; line-height: 1.6;">
                        {html_content}
                    </div>
                </div>
                """
                success = email_service.send_email(candidate_email, req.email_subject, html_body, smtp_config)
            elif req.status == "approved":
                success = email_service.send_approval_email(candidate_email, candidate_name, job_title, smtp_config)
            else:
                success = email_service.send_rejection_email(candidate_email, candidate_name, job_title, smtp_config)
        except Exception as exc:
            print(f"[SMTP ERROR] Failed to send decision email for app {app_id}: {exc}")

    # Delete the PDF from storage and clear the DB path upon HR decision
    if app_details.get("resume_path"):
        file_url = app_details["resume_path"]
        if file_url.startswith("http"):
            filename_key = file_url.split("/")[-1]
            try:
                storage.delete_resume(filename_key)
                database.clear_application_resume(app_id)
            except Exception as exc:
                print(f"[CLEANUP ERROR] Failed to delete resume {filename_key}: {exc}")

    updated = database.update_application_hr_status(app_id, req.status, success)

    await ws_manager.broadcast({
        "type": "status_update",
        "app_id": app_id,
        "status": req.status,
        "user_id": app_details["user_id"],
        "job_id": app_details["job_id"],
        "message": f"Application {req.status} for {job_title}",
    })

    try:
        stats = database.get_public_stats()
        await ws_manager.broadcast({"type": "stats_update", "stats": stats})
    except Exception as exc:
        print(f"[WS ERROR] Stats broadcast failed: {exc}")

    response = {
        "message": f"Application {req.status}. Email sent: {success}",
        "email_sent": success,
        "application": updated,
    }
    if email_warning:
        response["email_warning"] = email_warning

    return response


@router.get("/my-applications")
async def get_my_applications(current_user: dict = Depends(auth.require_role("candidate"))):
    """
    Return all job applications submitted by the currently logged-in candidate.

    @param current_user: Injected candidate user from auth dependency.
    @returns: List of application dicts with job title, AI scores, and HR status.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        return [_serialize_app(a) for a in database.get_applications_by_user(current_user["user_id"])]
    except Exception as exc:
        print(f"[APPS ERROR] Failed to fetch applications for user {current_user['user_id']}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load your applications.")


@router.post("/jobs/{job_id}/release-emails")
async def release_emails(
    job_id: int,
    request: Request,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """
    Bulk-send all pending decision emails for a job's applications (HR only).
    Sends both approval and rejection emails that haven't been dispatched yet.

    @param job_id: The job's database ID.
    @param request: HTTP request (used to access ws_manager from app.state).
    @param current_user: Injected HR user from auth dependency.
    @returns: Dict with released_count, failed_count, and a summary message.
    @raises HTTPException 403: If the job belongs to a different HR.
    @raises HTTPException 404: If the job does not exist.
    """
    ws_manager = request.app.state.ws_manager

    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="This job does not belong to you.")

    smtp_config = _build_smtp_config(current_user["user_id"])
    if not smtp_config:
        return {
            "message": "No SMTP settings configured. Please go to Settings → Email SMTP to configure your mail server before releasing emails.",
            "released_count": 0,
            "failed_count": 0,
        }

    pending = database.get_pending_emails_by_job(job_id)
    if not pending:
        return {"message": "No pending decision emails.", "released_count": 0, "failed_count": 0}

    sent_ids: list[int] = []
    failed_count = 0

    for app in pending:
        # Route to the correct email template based on HR's decision
        fn = (
            email_service.send_approval_email
            if app["hr_status"] == "approved"
            else email_service.send_rejection_email
        )
        if fn(app["applicant_email"], app["applicant_name"] or "Candidate", app["job_title"] or job["title"], smtp_config):
            sent_ids.append(app["id"])
        else:
            failed_count += 1

    if sent_ids:
        database.mark_application_emails_sent(sent_ids)

    try:
        stats = database.get_public_stats()
        await ws_manager.broadcast({"type": "stats_update", "stats": stats})
    except Exception as exc:
        print(f"[WS ERROR] Stats broadcast failed: {exc}")

    return {
        "message": f"Released {len(sent_ids)} emails, {failed_count} failed.",
        "released_count": len(sent_ids),
        "failed_count": failed_count,
    }


@router.get("/candidates")
async def get_all_candidates():
    """
    Return all candidate applications in the system, formatted for the Candidates view (HR only).

    @returns: List of simplified candidate dicts with name, role, score, and decision.
    @raises HTTPException 500: If the database query fails.
    """
    try:
        apps = database.get_all_applications()
    except Exception as exc:
        print(f"[APPS ERROR] Failed to fetch all candidates: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load candidate database.")

    return [
        {
            "id": app["id"],
            "candidate_name": app["candidate_name"] or app["applicant_name"] or "Unknown",
            "candidate_role": app["candidate_role"] or "N/A",
            "score": app["ai_score"],
            "decision": app["ai_decision"],
            "timestamp": str(app["created_at"])
        }
        for app in apps
    ]
