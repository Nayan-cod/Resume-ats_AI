"""
ResumeAI ATS — FastAPI application entry point.

Responsibilities:
  - App / middleware / static-files setup.
  - WebSocket connection manager.
  - Register all routers.
  - Chatbot KB initialisation (background thread).
  - Legacy single-resume analysis endpoint (landing-page demo).
  - Chat endpoint.
"""
import os
import shutil
import threading
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# ── WebSocket Manager ──────────────────────────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections for real-time push notifications."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a message to all connected clients, pruning dead connections."""
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

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router.router)
app.include_router(jobs_router.router)
app.include_router(applications_router.router)
app.include_router(settings_router.router)

# ── WebSocket Endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive / pings
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# ── Legacy / Demo Endpoints ────────────────────────────────────────────────────

@app.post("/analyze", tags=["demo"])
async def analyze_resume(
    resume_file: UploadFile = File(...),
    job_description: str = Form(...),
):
    """Legacy single-resume analysis endpoint (used by the landing-page demo widget)."""
    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_path = f"{TEMP_DIR}/{resume_file.filename}"
    try:
        with open(temp_path, "wb") as buf:
            shutil.copyfileobj(resume_file.file, buf)

        parsed_text = parser.parse_resume(temp_path)
        clean_text = privacy.anonymize_text(parsed_text)
        return await matcher.evaluate_candidate(clean_text, job_description)
    except Exception as exc:
        print(f"[ANALYZE ERROR] {exc}")
        return {"error": str(exc), "status": 500}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/api/chat", tags=["chat"])
async def chat_endpoint(req: ChatRequest):
    """Chat assistant endpoint for public inquiries about the platform."""
    messages_dict = [{"role": m.role, "content": m.content} for m in req.messages]
    response_text = await chatbot.generate_response(messages_dict)
    return {"response": response_text}


# ── Dev Server ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8001)),
        reload=True,
    )
