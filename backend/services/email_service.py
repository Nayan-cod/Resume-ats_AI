import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

def send_email(to_email: str, subject: str, html_body: str, smtp_config: dict = None):
    """Send an email using custom SMTP settings if provided, otherwise falling back to global ones."""
    email = SMTP_EMAIL
    password = SMTP_PASSWORD
    server_host = SMTP_SERVER
    server_port = SMTP_PORT

    if smtp_config:
        email = smtp_config.get("smtp_email") or email
        password = smtp_config.get("smtp_password") or password
        server_host = smtp_config.get("smtp_host") or server_host
        server_port = smtp_config.get("smtp_port") or server_port

    if not email or not password or email == "your_email@gmail.com":
        print(f"[EMAIL SKIPPED] SMTP not configured. Would send to: {to_email}")
        print(f"  Subject: {subject}")
        return False

    try:
        if isinstance(server_port, str):
            server_port = int(server_port)
    except ValueError:
        server_port = 587

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"ResumeAI ATS <{email}>"
        msg["To"] = to_email

        msg.attach(MIMEText(html_body, "html"))

        # Connect to SMTP (Support SSL for port 465, TLS for others)
        if server_port == 465:
            with smtplib.SMTP_SSL(server_host, server_port) as server:
                server.login(email, password)
                server.sendmail(email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(server_host, server_port) as server:
                server.starttls()
                server.login(email, password)
                server.sendmail(email, to_email, msg.as_string())

        print(f"[EMAIL SENT] To: {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        return False

def send_approval_email(to_email: str, candidate_name: str, job_title: str, smtp_config: dict = None):
    """Send an approval/selection email to a candidate."""
    subject = f"Congratulations! You've been selected for {job_title}"
    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #374151;">Hi <strong>{candidate_name}</strong>,</p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                We are thrilled to inform you that your application for the position of
                <strong style="color: #4f46e5;">{job_title}</strong> has been <strong style="color: #059669;">approved</strong>!
            </p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                Our HR team will reach out to you shortly with the next steps regarding the interview process.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-weight: 600;">✅ Status: Selected</p>
                <p style="margin: 5px 0 0; color: #166534;">Position: {job_title}</p>
            </div>
            <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">
                Best regards,<br>
                <strong>The Recruitment Team</strong><br>
                ResumeAI ATS Platform
            </p>
        </div>
    </div>
    """
    return send_email(to_email, subject, html_body, smtp_config)

def send_rejection_email(to_email: str, candidate_name: str, job_title: str, smtp_config: dict = None):
    """Send a rejection email to a candidate."""
    subject = f"Application Update for {job_title}"
    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6b7280 0%, #374151 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Application Update</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #374151;">Hi <strong>{candidate_name}</strong>,</p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                Thank you for your interest in the <strong style="color: #4f46e5;">{job_title}</strong> position
                and for taking the time to apply.
            </p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                After careful consideration, we have decided to move forward with other candidates
                whose qualifications more closely match our current needs.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">Status: Not Selected</p>
                <p style="margin: 5px 0 0; color: #991b1b;">Position: {job_title}</p>
            </div>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                We encourage you to apply for future openings that match your skills and experience.
                We wish you the very best in your career journey.
            </p>
            <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">
                Best regards,<br>
                <strong>The Recruitment Team</strong><br>
                ResumeAI ATS Platform
            </p>
        </div>
    </div>
    """
    return send_email(to_email, subject, html_body, smtp_config)
