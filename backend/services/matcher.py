"""
Matcher service: evaluates a resume against a job description using RAG + a HuggingFace LLM.
Returns a structured score, decision, and justification.
"""
import os
import re
import json
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace, HuggingFaceEndpointEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import SystemMessage, HumanMessage

from services.vector_store import SimpleQdrantVectorStore

load_dotenv()

# ── LLM & Embeddings Setup ──

MATCHER_REPO_ID = os.getenv("MATCHER_REPO_ID", "Qwen/Qwen2.5-7B-Instruct")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

_llm = HuggingFaceEndpoint(
    repo_id=MATCHER_REPO_ID,
    task="text-generation",
    do_sample=False,
    repetition_penalty=1.03,
    max_new_tokens=2048,
)

model = ChatHuggingFace(llm=_llm)

embeddings = HuggingFaceEndpointEmbeddings(
    model=EMBEDDINGS_MODEL,
    task="feature-extraction",
    huggingfacehub_api_token=os.getenv("HUGGINGFACEHUB_API_TOKEN"),
)

# ── Scorer Prompt ──

_SYSTEM_PROMPT = """You are a tough, critical Technical Recruiter. Evaluate the Resume against the Job Description (JD).

Scoring Rules (Be Critical):
- Base score is 0. Accumulate positive points for matches up to 100.
- Do NOT use negative marking (do NOT deduct points or give negative scores for missing items).
- Skills (up to 40 points): Award positive points for matching key skills found in the JD. Do not deduct points for missing skills.
- Experience (up to 30 points): Award positive points based on relevance and duration.
  - IMPORTANT: If the JD specifies a fresher requirement (e.g., "fresher", "entry level", "0 years", "intern", or no prior experience needed), neglect/ignore any lack of experience and award the candidate the full 30 points for the Experience category.
- Projects (up to 20 points): Award positive points for relevant projects showing impact.
- Education (up to 10 points): Award positive points for matching degree fields.

OUTPUT format (JSON ONLY):
{
  "candidate_name": "Name",
  "candidate_role": "Role",
  "score": 0,
  "decision": "Select/Hold/Reject",
  "justification": [
    {"point": "Skills Match", "details": "List MATCHING skills."},
    {"point": "Missing Skills", "details": "List MISSING skills from JD. Be specific."},
    {"point": "Experience", "details": "Critical analysis of relevance."},
    {"point": "Projects", "details": "Evaluation of complexity."}
  ]
}"""

_ERROR_RESPONSE = {
    "candidate_name": "Unknown Candidate",
    "candidate_role": "AI Parsed",
    "score": 0,
    "justification": ["Error parsing AI response. Please view raw logs."],
    "decision": "Error",
}


def _extract_json(raw: str) -> dict:
    """
    Parse the first JSON object from a (possibly Markdown-wrapped) LLM response.

    @param raw: Raw LLM output string, potentially wrapped in ```json ... ``` fences.
    @returns: Parsed dict with candidate_name, candidate_role, score, decision, justification.
    @raises json.JSONDecodeError: If no valid JSON object can be extracted.
    """
    cleaned = raw.strip()

    if "```" in cleaned:
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)
        else:
            cleaned = cleaned.replace("```json", "").replace("```", "")

    if "{" in cleaned:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        cleaned = cleaned[start:end]

    parsed = json.loads(cleaned)

    # Normalise justification to always be a list
    if "justification" in parsed and isinstance(parsed["justification"], str):
        parsed["justification"] = [parsed["justification"]]

    return parsed


async def evaluate_candidate(resume_text: str, job_description: str) -> dict:
    """
    Score a resume against a job description using RAG + LLM.

    Steps:
      1. Guard against excessively long inputs to prevent LLM token overflow.
      2. Chunk and embed the resume text into an in-memory Qdrant collection.
      3. Retrieve the most relevant chunks for the JD via semantic search.
      4. Ask the LLM to score and return a structured JSON result.

    @param resume_text: Plain-text content extracted from the candidate's PDF resume.
    @param job_description: The job description text to match the resume against.
    @returns: Dict with candidate_name, candidate_role, score (0-100), decision, and justification list.
    """
    # Cap inputs to avoid exceeding LLM context limits and controlling API costs
    resume_text = resume_text[:8000]
    job_description = job_description[:2000]

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = text_splitter.split_text(resume_text)

    context_text = resume_text[:4000]  # safe fallback
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.http import models as qdrant_models

        client = QdrantClient(location=":memory:")
        vector_size = len(embeddings.embed_query("test"))

        client.create_collection(
            collection_name="resume_chunks",
            vectors_config=qdrant_models.VectorParams(
                size=vector_size,
                distance=qdrant_models.Distance.COSINE,
            ),
        )

        store = SimpleQdrantVectorStore(
            client=client,
            collection_name="resume_chunks",
            embeddings=embeddings,
        )
        store.add_texts(chunks)

        query = "skills experience qualifications " + job_description[:200]
        found_docs = store.similarity_search(query, k=5)
        context_text = "\n\n".join(doc.page_content for doc in found_docs)

    except Exception as exc:
        print(f"[Matcher] Qdrant error: {exc}. Falling back to full text.")

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(
            content=f"JD: {job_description[:1000]}\n\nResume: {context_text[:2000]}"
        ),
    ]

    try:
        print(f"[Matcher] Invoking LLM ({MATCHER_REPO_ID})...")
        response = model.invoke(messages)
        print(f"[Matcher] Raw response: {response.content}")
        return _extract_json(response.content)
    except json.JSONDecodeError as exc:
        print(f"[Matcher] JSON parse error: {exc}")
        return _ERROR_RESPONSE
    except Exception as exc:
        print(f"[Matcher] LLM error: {exc}")
        return {
            "candidate_name": "Error",
            "candidate_role": "Unknown",
            "score": 0,
            "justification": ["Error calling API", str(exc)],
            "decision": "Error",
        }
