"""
MCP server for semantic/vector search over ingested documents.

Tools:
- query: Semantic search over documents
- answer: Compose an answer using RAG with citations
- similar_to_text: Find similar documents to provided text
- collections: List available collections
"""

import logging
import os
import re
from typing import Any

from fastapi import FastAPI, WebSocket

from packages.vectorstore import QdrantStore
from packages.llm import OllamaClient
from packages.mcp.base_handler import (
    MCPProtocolHandler,
    MCPServerInfo,
    mcp_websocket_handler,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Semantic MCP Server")

# Global instances
vector_store: QdrantStore | None = None
ollama_client: OllamaClient | None = None

QUERY_MIN_LEN = 3
QUERY_MAX_LEN = 512
SEMANTIC_MAX_TOP_K = 20
TAG_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
COLLECTION_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


@app.on_event("startup")
async def startup():
    """Initialize vector store and embeddings."""
    global vector_store, ollama_client

    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

    logger.info(f"Connecting to Qdrant at {qdrant_url}")
    vector_store = QdrantStore(url=qdrant_url)

    logger.info(f"Connecting to Ollama at {ollama_url}")
    auto_pull = os.environ.get("OLLAMA_AUTO_PULL", "1").lower() not in {"0", "false", "no"}
    ollama_client = OllamaClient(base_url=ollama_url, auto_pull=auto_pull)

    logger.info("Semantic server ready")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup."""
    if vector_store:
        await vector_store.close()
    if ollama_client:
        await ollama_client.close()


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


async def semantic_query(
    query: str,
    top_k: int = 5,
    tags: list[str] | None = None,
    collection: str | None = None,
) -> dict[str, Any]:
    """
    Perform semantic search.

    Args:
        query: Search query
        top_k: Number of results
        tags: Optional tag filters
        collection: Optional collection name

    Returns:
        Search results with text and metadata
    """
    if not vector_store or not ollama_client:
        return {"error": "Services not initialized"}

    if not isinstance(query, str):
        return {"error": "query must be a string"}
    query = query.strip()
    if len(query) < QUERY_MIN_LEN or len(query) > QUERY_MAX_LEN:
        return {
            "error": f"query must be between {QUERY_MIN_LEN} and {QUERY_MAX_LEN} characters",
        }

    if not isinstance(top_k, int) or top_k < 1 or top_k > SEMANTIC_MAX_TOP_K:
        return {"error": f"top_k must be between 1 and {SEMANTIC_MAX_TOP_K}"}

    if tags is not None:
        if not isinstance(tags, list):
            return {"error": "tags must be an array of strings"}
        sanitized_tags: list[str] = []
        for tag in tags:
            if not isinstance(tag, str):
                return {"error": "tags must be strings"}
            candidate = tag.strip()
            if not candidate or len(candidate) > 64 or not TAG_PATTERN.fullmatch(candidate):
                return {"error": "tags must match ^[A-Za-z0-9._-]+$ and be <= 64 chars"}
            sanitized_tags.append(candidate)
        tags = sanitized_tags

    if collection:
        if not isinstance(collection, str):
            return {"error": "collection must be a string"}
        collection = collection.strip()
        if not collection or len(collection) > 128 or not COLLECTION_PATTERN.fullmatch(collection):
            return {"error": "collection must match ^[A-Za-z0-9._-]+$ and be <= 128 chars"}

    try:
        # Generate query embedding
        embed_model = os.environ.get("EMBED_MODEL", "embeddinggemma:300m")
        query_embedding = await ollama_client.embed(query, model=embed_model)

        # Search vector store
        results = await vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            collection_name=collection,
            tags=tags,
        )

        # Format results
        formatted_results = []
        for result in results:
            formatted_results.append(
                {
                    "id": result.id,
                    "text": result.text,
                    "score": result.score,
                    "metadata": result.metadata,
                }
            )

        logger.info(f"Query returned {len(formatted_results)} results")
        return {"results": formatted_results, "query": query}

    except Exception as e:
        logger.error(f"Query failed: {e}")
        return {"error": str(e)}


async def list_collections() -> dict[str, Any]:
    """List all collections."""
    if not vector_store:
        return {"error": "Vector store not initialized"}

    try:
        collections = await vector_store.list_collections()
        logger.info(f"Found {len(collections)} collections")
        return {"collections": collections}

    except Exception as e:
        logger.error(f"List collections failed: {e}")
        return {"error": str(e)}


async def semantic_answer(
    question: str,
    top_k: int = 5,
    tags: list[str] | None = None,
    collection: str | None = None,
) -> dict[str, Any]:
    """RAG answer: embed → search → LLM synthesis with citations."""
    if not vector_store or not ollama_client:
        return {"error": "Services not initialized"}

    # Validate using same rules as query
    base = await semantic_query(question, top_k=min(top_k, 5), tags=tags, collection=collection)
    if "error" in base:
        return base

    # Prepare context for LLM
    results = base.get("results", [])[: top_k or 5]
    if not results:
        return {"answer": "Nessun contenuto trovato nei documenti.", "citations": []}

    def _snippet(text: str, limit: int = 800) -> str:
        return (text or "")[:limit]

    context_lines: list[str] = []
    citations: list[dict[str, Any]] = []
    for idx, r in enumerate(results, start=1):
        uri = (r.get("metadata", {}) or {}).get("uri")
        score = r.get("score")
        text = r.get("text", "")
        snip = _snippet(text)
        context_lines.append(f"[{idx}] Source: {uri or r.get('id')}, Score: {score}\n{snip}")
        citations.append(
            {
                "index": idx,
                "id": r.get("id"),
                "uri": uri,
                "score": score,
                "snippet": snip,
            }
        )

    system_msg = (
        "You are a helpful assistant. Use ONLY the provided context snippets to answer."
        " Cite sources using bracketed numbers like [1], [2]. If unsure, say you don't know."
    )
    user_msg = f"Question: {question}\n\nContext:\n" + "\n\n".join(context_lines)

    from packages.llm import ChatMessage

    msgs = [
        ChatMessage(role="system", content=system_msg),
        ChatMessage(role="user", content=user_msg),
    ]

    # Stream and accumulate final answer
    answer_text = ""
    async for chunk in ollama_client.chat_stream(
        messages=msgs, model=os.environ.get("CHAT_MODEL", "gpt-oss:20b"), tools=None
    ):
        if chunk.content:
            answer_text += chunk.content

    return {"answer": answer_text.strip(), "citations": citations}


async def similar_to_text(
    text: str,
    top_k: int = 5,
    tags: list[str] | None = None,
    collection: str | None = None,
) -> dict[str, Any]:
    """Find docs similar to the provided text (not a short query)."""
    if not vector_store or not ollama_client:
        return {"error": "Services not initialized"}
    if not isinstance(text, str) or not text.strip():
        return {"error": "text must be a non-empty string"}
    if not isinstance(top_k, int) or top_k < 1 or top_k > SEMANTIC_MAX_TOP_K:
        return {"error": f"top_k must be between 1 and {SEMANTIC_MAX_TOP_K}"}

    # Validate tags and collection using same regex/patterns
    if tags is not None:
        sanitized_tags: list[str] = []
        for tag in tags:
            if not isinstance(tag, str):
                return {"error": "tags must be strings"}
            candidate = tag.strip()
            if not candidate or len(candidate) > 64 or not TAG_PATTERN.fullmatch(candidate):
                return {"error": "tags must match ^[A-Za-z0-9._-]+$ and be <= 64 chars"}
            sanitized_tags.append(candidate)
        tags = sanitized_tags
    if collection:
        if not isinstance(collection, str):
            return {"error": "collection must be a string"}
        collection = collection.strip()
        if not collection or len(collection) > 128 or not COLLECTION_PATTERN.fullmatch(collection):
            return {"error": "collection must match ^[A-Za-z0-9._-]+$ and be <= 128 chars"}

    try:
        embed_model = os.environ.get("EMBED_MODEL", "embeddinggemma:300m")
        query_embedding = await ollama_client.embed(text, model=embed_model)
        results = await vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            collection_name=collection,
            tags=tags,
        )
        formatted = [
            {"id": r.id, "text": r.text, "score": r.score, "metadata": r.metadata} for r in results
        ]
        return {"results": formatted}
    except Exception as e:
        logger.error(f"similar_to_text failed: {e}")
        return {"error": str(e)}


# Initialize MCP protocol handler
mcp_handler = MCPProtocolHandler(
    server_info=MCPServerInfo(
        name="semantic",
        version="0.1.0",
    )
)

# Register tools
mcp_handler.register_tool(
    name="query",
    description="Perform semantic search over ingested documents. Returns relevant document chunks with similarity scores.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
                "minLength": QUERY_MIN_LEN,
                "maxLength": QUERY_MAX_LEN,
            },
            "top_k": {
                "type": "integer",
                "description": "Number of results to return",
                "default": 5,
                "minimum": 1,
                "maximum": SEMANTIC_MAX_TOP_K,
            },
            "tags": {
                "type": "array",
                "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": r"^[A-Za-z0-9._-]+$",
                },
                "description": "Optional tags to filter by",
                "maxItems": 10,
            },
            "collection": {
                "type": "string",
                "description": "Optional collection name (defaults to 'documents')",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9._-]+$",
            },
        },
        "required": ["query"],
        "additionalProperties": False,
    },
    handler=lambda query, top_k=5, tags=None, collection=None: semantic_query(
        query=query, top_k=top_k, tags=tags, collection=collection
    ),
)

mcp_handler.register_tool(
    name="answer",
    description="RAG answer composer with citations from the vector store.",
    input_schema={
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "Question to answer using retrieved context",
                "minLength": QUERY_MIN_LEN,
                "maxLength": QUERY_MAX_LEN,
            },
            "top_k": {
                "type": "integer",
                "description": "Number of documents to retrieve for context",
                "default": 5,
                "minimum": 1,
                "maximum": SEMANTIC_MAX_TOP_K,
            },
            "tags": {
                "type": "array",
                "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": r"^[A-Za-z0-9._-]+$",
                },
                "description": "Optional tags to filter by",
                "maxItems": 10,
            },
            "collection": {
                "type": "string",
                "description": "Optional collection name",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9._-]+$",
            },
        },
        "required": ["question"],
        "additionalProperties": False,
    },
    handler=lambda question, top_k=5, tags=None, collection=None: semantic_answer(
        question=question, top_k=top_k, tags=tags, collection=collection
    ),
)

mcp_handler.register_tool(
    name="similar_to_text",
    description="Find similar documents to the provided text (not just a short query).",
    input_schema={
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Text body to find similar content for",
                "minLength": 1,
                "maxLength": QUERY_MAX_LEN,
            },
            "top_k": {
                "type": "integer",
                "description": "Number of results to return",
                "default": 5,
                "minimum": 1,
                "maximum": SEMANTIC_MAX_TOP_K,
            },
            "tags": {
                "type": "array",
                "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": r"^[A-Za-z0-9._-]+$",
                },
                "description": "Optional tags to filter by",
                "maxItems": 10,
            },
            "collection": {
                "type": "string",
                "description": "Optional collection name",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"^[A-Za-z0-9._-]+$",
            },
        },
        "required": ["text"],
        "additionalProperties": False,
    },
    handler=lambda text, top_k=5, tags=None, collection=None: similar_to_text(
        text=text, top_k=top_k, tags=tags, collection=collection
    ),
)

mcp_handler.register_tool(
    name="collections",
    description="List all available document collections in the vector store.",
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
    handler=lambda: list_collections(),
)


@app.websocket("/mcp")
async def mcp_socket(ws: WebSocket):
    """MCP WebSocket endpoint using base handler."""
    await mcp_websocket_handler(ws, mcp_handler)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7002)
