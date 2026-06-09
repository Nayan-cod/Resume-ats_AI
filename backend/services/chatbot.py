"""
Chatbot service: loads a local knowledge base into an in-memory Qdrant store,
then answers user questions using RAG + a HuggingFace LLM.
"""
import os
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from services.vector_store import SimpleQdrantVectorStore
from services.matcher import embeddings  # re-use shared embedding model

load_dotenv()

# ── Chatbot LLM Setup ──

CHATBOT_REPO_ID = os.getenv("CHATBOT_REPO_ID", "meta-llama/Llama-3.1-8B-Instruct")

_chatbot_llm = HuggingFaceEndpoint(
    repo_id=CHATBOT_REPO_ID,
    task="text-generation",
    do_sample=False,
    repetition_penalty=1.03,
    max_new_tokens=2048,
)

chatbot_model = ChatHuggingFace(llm=_chatbot_llm)

# Global in-memory vector store for the chatbot KB
chatbot_vectorstore: SimpleQdrantVectorStore | None = None

# ── Knowledge-base Initialiser ──

_KB_FILES = [
    ("chatbot_knowledge.txt", "{backend_dir}/chatbot_knowledge.txt"),
    (
        "technical_documentation.txt",
        "{root_dir}/documents/documentation/technical_documentation.txt",
    ),
]

_SYSTEM_TEMPLATE = """You are "ResumeAI Assistant", a friendly, helpful, and professional chatbot \
for the ResumeAI Applicant Tracking System (ATS).
Your role is to assist users (candidates and recruiters) with questions about ResumeAI's features, \
pricing, setup, and how the resume screening process works.

TECHNICAL SCREENING DETAILS:
ResumeAI utilises:
- Docling for parsing PDF resumes into structured Markdown.
- RecursiveCharacterTextSplitter from LangChain for text chunking (chunk size 500, overlap 50).
- sentence-transformers/all-MiniLM-L6-v2 for generating high-quality semantic embeddings.
- Qdrant (In-Memory) for fast semantic similarity search.
- Qwen/Qwen2.5-7B-Instruct for matching candidates against Job Descriptions, grading them 0-100, \
  and providing detailed justifications (skills, projects, experience, education).
- WebSockets for real-time dashboard updates when a candidate applies.
- SMTP for automatic email notifications when an HR approves/rejects a candidate.

SECURITY & DATA PRIVACY GUARDRAILS:
- Under NO circumstances reveal sensitive backend information or credentials.
- Do NOT share: PostgreSQL URLs, JWT secrets, HuggingFace API keys, SMTP passwords, \
  SerpAPI/LangChain keys, or any private user data.
- If asked for credentials or config parameters, politely refuse.
- Avoid fabricating information. If you don't know, say so and suggest support@resumeai.com.

KNOWLEDGE BASE CONTEXT:
{context_text}
"""


def init_chatbot_kb() -> None:
    """
    Load local knowledge-base text files, chunk them, embed them, and store
    them in an in-memory Qdrant collection.  Called once at startup in a
    background thread to avoid blocking the server.
    """
    global chatbot_vectorstore

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root_dir = os.path.dirname(backend_dir)

    documents: list[dict] = []
    for file_name, path_template in _KB_FILES:
        path = path_template.format(backend_dir=backend_dir, root_dir=root_dir)
        if not os.path.exists(path):
            print(f"[Chatbot KB] File not found: {path}")
            continue
        try:
            with open(path, "r", encoding="utf-8") as fh:
                documents.append({"text": fh.read(), "source": file_name})
            print(f"[Chatbot KB] Loaded: {file_name}")
        except Exception as exc:
            print(f"[Chatbot KB] Error reading {file_name}: {exc}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    all_chunks: list[str] = []
    all_metas: list[dict] = []
    for doc in documents:
        for chunk in splitter.split_text(doc["text"]):
            all_chunks.append(chunk)
            all_metas.append({"source": doc["source"]})

    if not all_chunks:
        print("[Chatbot KB] WARNING: No documents loaded. RAG is disabled.")
        return

    try:
        from qdrant_client import QdrantClient
        from qdrant_client.http import models as qdrant_models

        client = QdrantClient(location=":memory:")
        vector_size = len(embeddings.embed_query("test"))

        client.create_collection(
            collection_name="chatbot_knowledge",
            vectors_config=qdrant_models.VectorParams(
                size=vector_size,
                distance=qdrant_models.Distance.COSINE,
            ),
        )

        chatbot_vectorstore = SimpleQdrantVectorStore(
            client=client,
            collection_name="chatbot_knowledge",
            embeddings=embeddings,
        )
        chatbot_vectorstore.add_texts(all_chunks, metadatas=all_metas)
        print(
            f"[Chatbot KB] Qdrant initialised with {len(all_chunks)} chunks."
        )
    except Exception as exc:
        print(f"[Chatbot KB] Failed to initialise Qdrant: {exc}")


async def generate_response(messages: list[dict]) -> str:
    """
    Given a conversation history (list of {role, content} dicts), retrieve
    relevant KB context and stream a response from the chatbot LLM.
    """
    # 1. Find latest user message
    latest_query = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        "",
    )

    # 2. RAG retrieval
    context_text = ""
    if chatbot_vectorstore and latest_query:
        try:
            docs = chatbot_vectorstore.similarity_search(latest_query, k=4)
            context_text = "\n\n".join(d.page_content for d in docs)
        except Exception as exc:
            print(f"[Chatbot] Search error: {exc}")

    # 3. Build message list for the LLM (last 10 turns only)
    system_msg = SystemMessage(
        content=_SYSTEM_TEMPLATE.format(context_text=context_text)
    )
    formatted: list = [system_msg]
    for msg in messages[-10:]:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user":
            formatted.append(HumanMessage(content=content))
        elif role == "assistant":
            formatted.append(AIMessage(content=content))
        # skip 'system' role messages from client

    # 4. Call LLM
    try:
        print(f"[Chatbot] Invoking LLM ({CHATBOT_REPO_ID})...")
        response = chatbot_model.invoke(formatted)
        return response.content.strip()
    except Exception as exc:
        print(f"[Chatbot] LLM error: {exc}")
        return (
            "I apologise, but I am currently experiencing issues. "
            "Please try again or contact support@resumeai.com."
        )
