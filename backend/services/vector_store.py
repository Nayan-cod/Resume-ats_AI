"""
Shared in-memory Qdrant vector store wrapper.
Used by both the AI matcher and the chatbot knowledge base.
"""
import uuid
from langchain_core.documents import Document


class SimpleQdrantVectorStore:
    """
    Thin wrapper around the Qdrant client that provides add_texts / similarity_search
    using the modern query_points API (qdrant-client >= 1.9).
    """

    def __init__(self, client, collection_name: str, embeddings):
        self.client = client
        self.collection_name = collection_name
        self.embeddings = embeddings

    def add_texts(self, texts: list[str], metadatas: list[dict] | None = None):
        """Embed and upsert a list of text chunks into the collection."""
        from qdrant_client.http import models as qdrant_models

        vectors = self.embeddings.embed_documents(texts)
        points = []
        for idx, (text, vec) in enumerate(zip(texts, vectors)):
            meta = metadatas[idx] if metadatas and idx < len(metadatas) else {}
            points.append(
                qdrant_models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vec,
                    payload={"page_content": text, "metadata": meta},
                )
            )
        self.client.upsert(collection_name=self.collection_name, points=points)

    def similarity_search(self, query: str, k: int = 4) -> list[Document]:
        """Return the top-k most similar documents for the given query string."""
        query_vector = self.embeddings.embed_query(query)
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=k,
            with_payload=True,
        )
        return [
            Document(
                page_content=p.payload.get("page_content", ""),
                metadata=p.payload.get("metadata", {}),
            )
            for p in response.points
        ]
