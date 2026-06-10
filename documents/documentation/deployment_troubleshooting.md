# ResumeAI ATS: Technical Architecture, Deployment & Troubleshooting Guide

This document covers the technical architecture, deployment process, and critical issues encountered during deployment along with their solutions.

---

## 1. Technical Architecture Overview

ResumeAI ATS is an AI-powered Applicant Tracking System consisting of a decoupled frontend and backend:

* **Frontend**: React application built with Vite and TailwindCSS, deployed to **Vercel**.
* **Backend**: FastAPI web framework, deployed to **Render** as a Web Service.
* **Database**: PostgreSQL database instance hosted on **Supabase** (with connection pooling).
* **AI & Embedding Models**:
  * **Docling**: Parses candidate PDF resumes into structured Markdown.
  * **Sentence Transformers (`all-MiniLM-L6-v2`)**: Generates 384-dimensional vector embeddings for semantically matching candidates to job descriptions.
  * **Qdrant (In-Memory)**: Powers real-time semantic similarity searches for the chatbot knowledge base.
  * **Qwen/Qwen2.5-7B-Instruct**: Evaluates candidate resumes against job descriptions to score (0-100) and justify alignment.

---

## 2. Deployment Process

### Backend Deployment (Render)
1. **Create Web Service**: Connect your GitHub repository to Render and create a new **Web Service**.
2. **Build & Start Commands**:
   * **Root Directory**: `backend` (or build from repo root using target directories)
   * **Start Command**: `python main.py` or `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**: Set the following variables in the Render Service dashboard under **Environment**:
   * `DATABASE_URL`: Your Supabase connection string.
   * `CORS_ORIGINS`: Comma-separated domains allowed to access the backend (e.g. `https://resume-ats-ai-theta.vercel.app`).
   * `JWT_SECRET`: A secure random string for JWT hashing.
   * `HUGGINGFACEHUB_API_TOKEN`: Token for HuggingFace API model calls.
   * `SMTP_EMAIL` & `SMTP_PASSWORD`: SMTP server credentials for automatic HR notification emails.
   * `SMTP_ENCRYPTION_KEY`: A secure Fernet key to encrypt stored SMTP passwords (generated using `cryptography`).

### Frontend Deployment (Vercel)
1. **Create Project**: Import your repository into Vercel.
2. **Framework Preset**: Choose **Vite**.
3. **Root Directory**: `frontend`
4. **Environment Variables**:
   * `VITE_API_URL`: Your deployed Render API URL (e.g., `https://resume-ats-backend-ydv3.onrender.com`).
   * `VITE_WS_URL`: The WebSocket address corresponding to the backend (e.g., `wss://resume-ats-backend-ydv3.onrender.com/ws`).

---

## 3. Issues Occurred & Solutions

Below is the detailed list of issues encountered during deployment, analysis of their root causes, and how we resolved them:

### Issue 1: Database URL Connection Failures (`psycopg2.OperationalError`)
* **Symptom**: The backend service crashed on startup with `psycopg2.OperationalError: invalid sslmode value: "require\n"`.
* **Root Cause**: When copy-pasting the connection URL into the Render dashboard environment variable textbox, a trailing newline or carriage return character was accidentally appended. `psycopg2.connect` read this as `sslmode="require\n"`, which is an invalid value.
* **Solution**: Updated `backend/services/database.py` to strip any leading/trailing whitespace, newlines, or carriage returns from the fetched environment variable:
  ```python
  DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ats_db").strip()
  ```

### Issue 2: CORS Failures on Vercel Previews
* **Symptom**: Browser blocked API requests from Vercel branches with `Access-Control-Allow-Origin` errors.
* **Root Cause**: The backend's `CORS_ORIGINS` was configured with strict, static domains (like localhost), and Starlette's CORSMiddleware does not allow wildcards (`*`) when `allow_credentials=True`. Additionally, copying the origin with a trailing slash (e.g. `domain.com/`) caused matching mismatches since browsers emit origins without trailing slashes.
* **Solution**: Modified `backend/main.py` to:
  * Trim whitespace and strip trailing slashes (`.rstrip('/')`) from all configured origins.
  * Register the main production domain (`https://resume-ats-ai-theta.vercel.app`) as a default origin.
  * Enable Starlette's `allow_origin_regex` to match all subdomains of `.vercel.app` dynamically, allowing preview branch deployments to connect out-of-the-box:
    ```python
    allow_origin_regex=r"https://.*\.vercel\.app"
    ```

### Issue 3: Hardcoded Localhost Frontend Fetches
* **Symptom**: Pages like *Job Postings* or *Candidates* failed to load on Vercel with `ERR_CONNECTION_REFUSED` or returned `404 Not Found`.
* **Root Cause**: Frontend pages (`ScreeningWidget.jsx`, `JobPostings.jsx`, `Candidates.jsx`) had `http://localhost:8001` endpoints hardcoded. Also, public routes in the backend are prefixed under `/api` (e.g., `/api/jobs` and `/api/candidates`), but pages were fetching from base roots without the `/api` prefix.
* **Solution**:
  * Added the missing `/api/candidates` query endpoint on the backend in `database.py` and `applications.py`.
  * Replaced all hardcoded `http://localhost:8001` fetches with the centralized configuration `API_URL` import from `frontend/src/lib/config.js`.
  * Prepended the appropriate `/api` route prefixes to the fetch paths:
    * Job Postings uses: `${API_URL}/api/jobs`
    * Candidates Database uses: `${API_URL}/api/candidates`
    * Screening Widget uses: `${API_URL}/analyze` (as this endpoint is registered without the `/api` prefix on `main.py`).

### Issue 4: Chatbot Knowledge Base Warnings on Startup
* **Symptom**: Startup logs printed warnings: `[Chatbot KB] File not found: /opt/render/project/src/documents/documentation/technical_documentation.txt`.
* **Root Cause**: The chatbot service searches for file paths declared in its `_KB_FILES` list to build context. The file `technical_documentation.txt` did not exist in the repository structure.
* **Solution**: Created a structured [technical_documentation.txt](file:///c:/College/Resume-ats_AI/documents/documentation/technical_documentation.txt) file in the `documents/documentation/` folder, describing the system architecture and stack. This clears the missing file warnings and populates the RAG chatbot's context.

### Issue 5: Duplicate Loading / Uvicorn Reloader Overhead on Render
* **Symptom**: Render logs showed that the server initiated the startup sequence twice (e.g. indexing the Qdrant database twice).
* **Root Cause**: The server runner script in `main.py` was hardcoded to `reload=True`. On production environments like Render, this wastes CPU/memory and triggers duplicate worker startup threads.
* **Solution**: Modified `backend/main.py` to read the `RENDER` environment variable set by Render's host and dynamically turn reload off in production:
  ```python
  is_render = os.getenv("RENDER") == "true"
  uvicorn.run("main:app", host=..., port=..., reload=not is_render)
  ```

### Issue 6: Page Not Found (404) When Refreshing Any Route on Vercel
* **Symptom**: Refreshing the browser on `/login`, `/dashboard`, `/settings`, or any sub-route returned Vercel's built-in 404 error page instead of the React application.
* **Root Cause**: The React application uses `BrowserRouter` (HTML5 History API) for client-side navigation. When a user refreshes a route like `/dashboard`, Vercel's CDN looks for a physical file at that path (`/dashboard/index.html`), finds none, and returns 404. Vercel does not automatically know this is a Single Page Application (SPA).
* **Solution**: Created `frontend/vercel.json` with a catch-all rewrite rule that redirects all non-file requests to `index.html`, allowing React Router to handle the routing client-side:
  ```json
  {
    "rewrites": [
      { "source": "/((?!api/).*)", "destination": "/index.html" }
    ]
  }
  ```
  The negative lookahead `(?!api/)` ensures actual `/api/` requests are not rewritten, preserving any future direct backend calls.

### Issue 7: Emails Not Sent for Rejected Candidates (Release Emails Feature)
* **Symptom**: Clicking "Release Emails" for a job only sent emails to approved candidates. Rejected candidates never received a decision email via the bulk-release feature.
* **Root Cause**: The `get_pending_emails_by_job()` function in `backend/services/database.py` had a hardcoded filter: `WHERE a.hr_status = 'approved'`. This meant rejected candidates were never included in the bulk email queue.
* **Solution**: Updated the SQL query to include both `approved` and `rejected` statuses:
  ```python
  WHERE a.job_id = %s
    AND a.hr_status IN ('approved', 'rejected')
    AND a.email_sent = FALSE
  ```
  Additionally, `backend/routers/applications.py` was updated to route each pending application to the correct email template (`send_approval_email` or `send_rejection_email`) based on `app["hr_status"]`.

### Issue 7b: HR Email Settings & SMTP Port Blocks on Render Free Tier
* **Summary**: Each HR user can configure their own outbound mail server under **Settings → Email SMTP**. This is stored encrypted in the database and used when approving or rejecting candidates. If no SMTP is configured for an HR, the dashboard displays a clear warning: *"Email not sent: No SMTP settings configured. Go to Settings → Email SMTP to set up your mail server."*
* **Recommended SMTP for Gmail**: Use port `587` with STARTTLS, and generate a **Google App Password** (not your account password) at myaccount.google.com → Security → App Passwords.
* **Outbound SMTP Port Blocks on Render Free Tier**:
  * **Symptom**: Outbound SMTP email dispatches fail or hang with connection timeouts on the deployed Render environment, even though the exact same credentials and settings succeed 100% when tested locally.
  * **Root Cause**: Render blocks all outbound network traffic on standard SMTP ports (**25**, **465**, and **587**) for all services running on the **Free Tier** to prevent spam and abuse.
  * **Solution**: To enable custom SMTP email sending from the live deployed app, you must **upgrade the Render Web Service to a Paid Plan** (such as the $7/month Starter instance), which instantly lifts the outbound SMTP port block.


