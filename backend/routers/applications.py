"""
Application routes: apply, status update, HR views, candidate views.
The ws_manager dependency is injected by main.py at startup via app.state.
"""
import os
import shutil
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from pydantic import BaseModel

from services import database, auth, parser, privacy, matcher, email_service, security, storage

router = APIRouter(prefix="/api", tags=["applications"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
TEMP_DIR = os.getenv("TEMP_DIR", "temp")


class UpdateStatusRequest(BaseModel):
    status: str  # 'approved' or 'rejected'
    email_subject: Optional[str] = None
    email_body: Optional[str] = None


def _serialize_app(app: dict) -> dict:
    if app.get("created_at"):
        app["created_at"] = str(app["created_at"])
    return app


def _build_smtp_config(hr_id: int) -> dict | None:
    """Load and decrypt the HR's stored SMTP credentials."""
    hr_smtp = database.get_hr_smtp(hr_id)
    if not hr_smtp:
        return None
    return {
        "smtp_email": hr_smtp["smtp_email"],
        "smtp_host": hr_smtp["smtp_host"],
        "smtp_port": hr_smtp["smtp_port"],
        "smtp_password": security.decrypt_password(hr_smtp["encrypted_smtp_password"]),
    }


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    request: Request,
    resume_file: UploadFile = File(...),
    current_user: dict = Depends(auth.require_role("candidate")),
):
    """Submit a resume application (Candidate only). Triggers async AI screening."""
    ws_manager = request.app.state.ws_manager

    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

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
        # Delete from Supabase and local temp if DB save fails
        storage.delete_resume(safe_filename)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="You have already applied to this job")
        raise HTTPException(status_code=500, detail=str(exc))

    # AI screening
    try:
        try:
            parsed_text = parser.parse_resume(temp_path)
        finally:
            # Delete local file immediately after parsing to avoid disk usage
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
        database.update_application_ai(
            app_id=application["id"],
            score=0,
            decision="Error",
            justification=json.dumps([f"AI screening failed: {exc}"]),
            candidate_name="",
            candidate_role="",
        )

    try:
        stats = database.get_public_stats()
        await ws_manager.broadcast({"type": "stats_update", "stats": stats})
    except Exception as exc:
        print(f"[WS ERROR] Stats broadcast failed: {exc}")

    return {"message": "Application submitted successfully", "application": _serialize_app(application)}



@router.get("/hr/jobs/{job_id}/applications")
async def get_job_applications(
    job_id: int,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """Return all applications for a specific job (HR only), sorted by AI score."""
    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="This job does not belong to you")

    return [_serialize_app(a) for a in database.get_applications_by_job(job_id)]


@router.patch("/applications/{app_id}/status")
async def update_application_status(
    app_id: int,
    req: UpdateStatusRequest,
    request: Request,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """Approve or reject an application and send the decision email (HR only)."""
    ws_manager = request.app.state.ws_manager

    if req.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    app_details = database.get_application_by_id(app_id)
    if not app_details:
        raise HTTPException(status_code=404, detail="Application not found")

    job = database.get_job_by_id(app_details["job_id"])
    if not job or job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You don't have permission to update this application")

    smtp_config = _build_smtp_config(current_user["user_id"])

    candidate_email = app_details["applicant_email"]
    candidate_name = app_details.get("candidate_name") or app_details.get("applicant_name", "Candidate")
    job_title = app_details.get("job_title", "the position")

    success = False
    try:
        if req.email_subject and req.email_body:
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
        print(f"[SMTP ERROR] {exc}")

    # Delete the PDF file from storage and clear the DB path upon decision
    if app_details.get("resume_path"):
        file_url = app_details["resume_path"]
        if file_url.startswith("http"):
            filename_key = file_url.split("/")[-1]
            try:
                storage.delete_resume(filename_key)
                database.clear_application_resume(app_id)
            except Exception as exc:
                print(f"[CLEANUP ERROR] Failed to delete resume {filename_key} from storage: {exc}")

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

    return {
        "message": f"Application {req.status}. Email sent: {success}",
        "application": updated,
    }


@router.get("/my-applications")
async def get_my_applications(current_user: dict = Depends(auth.require_role("candidate"))):
    """Return all applications for the logged-in candidate."""
    return [_serialize_app(a) for a in database.get_applications_by_user(current_user["user_id"])]


@router.post("/jobs/{job_id}/release-emails")
async def release_emails(
    job_id: int,
    request: Request,
    current_user: dict = Depends(auth.require_role("hr")),
):
    """Release all pending decision emails for a job's applications."""
    ws_manager = request.app.state.ws_manager

    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["hr_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="This job does not belong to you")

    smtp_config = _build_smtp_config(current_user["user_id"])
    pending = database.get_pending_emails_by_job(job_id)
    if not pending:
        return {"message": "No pending decision emails.", "released_count": 0}

    sent_ids: list[int] = []
    failed_count = 0

    for app in pending:
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
