"""
ResumeAI ATS — FastAPI application entry point.

Responsibilities:
  - App / middleware / static-files setup.
  - WebSocket connection manager.
  - Register all routers.
  - Chatbot KB initialisation (background thread).
  - Legacy single-resume analysis endpoint (landing-page demo).
  - Chat endpoint.
  - Global error handlers for consistent error response shapes.
"""
import os
import shutil
import threading
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from services import parser, privacy, matcher, database, chatbot
from routers import auth as auth_router
from routers import jobs as jobs_router
from routers import applications as applications_router
from routers import settings as settings_router

# ── App Setup ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ResumeAI ATS API",
    version="1.0.0",
    description="AI-powered Applicant Tracking System backend.",
)

origins = [o.strip().rstrip('/') for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://resume-ats-ai-theta.vercel.app"
]
for default in default_origins:
    if default not in origins:
        origins.append(default)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
TEMP_DIR = os.getenv("TEMP_DIR", "temp")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount(f"/{UPLOAD_DIR}", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Global Error Handlers ──────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Return a consistent error shape for all HTTPExceptions:
    { success: false, error: { code, message } }
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled exceptions. Returns a safe generic message
    so internal details (stack traces, DB errors) are never exposed to clients.
    """
    print(f"[UNHANDLED ERROR] {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": 500,
                # [ACTION NEEDED]: In production, never expose raw exc details.
                # Switch to a generic message once debugging is complete.
                "message": "An unexpected server error occurred. Please try again later.",
            },
        },
    )

# ── WebSocket Manager ──────────────────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for real-time push notifications."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        Accept a new WebSocket connection and register it.

        @param websocket: The WebSocket connection to register.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket from the active pool on disconnect.

        @param websocket: The WebSocket connection to remove.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Send a JSON message to all connected clients, pruning dead connections.

        @param message: The dictionary to serialise and broadcast.
        """
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.active_connections.remove(conn)


ws_manager = ConnectionManager()
app.state.ws_manager = ws_manager  # Injected into routers via request.app.state

# ── Startup Tasks ──────────────────────────────────────────────────────────────

database.init_db()
threading.Thread(target=chatbot.init_chatbot_kb, daemon=True).start()

@app.get("/", tags=["status"])
async def root():
    """Health-check endpoint confirming the API is online."""
    return {
        "status": "online",
        "service": "ResumeAI ATS API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router.router)
app.include_router(jobs_router.router)
app.include_router(applications_router.router)
app.include_router(settings_router.router)

# ── WebSocket Endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time HR dashboard and candidate notifications."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive / pings
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# ── Legacy / Demo Endpoints ────────────────────────────────────────────────────

# [ACTION NEEDED]: This public endpoint has no rate limiting. On Render/production,
# configure a reverse-proxy rate limit (e.g., nginx, Cloudflare) to prevent abuse.
@app.post("/analyze", tags=["demo"])
async def analyze_resume(
    resume_file: UploadFile = File(...),
    job_description: str = Form(...),
):
    """
    Legacy single-resume analysis endpoint used by the landing-page demo widget.

    @param resume_file: The uploaded PDF resume file.
    @param job_description: The job description text to match against.
    @returns: AI evaluation result dict with score, decision, and justification.
    """
    # Validate file type — only PDFs are accepted
    if not resume_file.filename or not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Validate job description is not empty
    if not job_description or not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_path = f"{TEMP_DIR}/{resume_file.filename}"
    try:
        with open(temp_path, "wb") as buf:
            shutil.copyfileobj(resume_file.file, buf)

        parsed_text = parser.parse_resume(temp_path)
        clean_text = privacy.anonymize_text(parsed_text)
        return await matcher.evaluate_candidate(clean_text, job_description)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ANALYZE ERROR] {exc}")
        raise HTTPException(status_code=500, detail="Resume analysis failed. Please try again.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


# [ACTION NEEDED]: This public endpoint has no rate limiting. Configure
# rate limiting at the reverse-proxy level to prevent LLM API cost abuse.
@app.post("/api/chat", tags=["chat"])
async def chat_endpoint(req: ChatRequest):
    """
    Chat assistant endpoint for public inquiries about the platform.

    @param req: ChatRequest containing the conversation message history.
    @returns: Dict with a 'response' key containing the assistant's reply.
    """
    # Guard: reject empty message lists
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty.")

    messages_dict = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        response_text = await chatbot.generate_response(messages_dict)
    except Exception as exc:
        print(f"[CHAT ERROR] {exc}")
        raise HTTPException(status_code=500, detail="Chat service is temporarily unavailable.")
    return {"response": response_text}


# ── Dev Server ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # Disable reload in production on Render to save resources and prevent duplicate startups
    is_render = os.getenv("RENDER") == "true"

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8001)),
        reload=not is_render,
    )
