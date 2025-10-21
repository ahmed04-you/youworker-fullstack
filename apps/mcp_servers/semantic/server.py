"""
MCP server for semantic/vector search over ingested documents.

Tools:
- query: Semantic search over documents
- collections: List available collections
"""
import logging
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from packages.vectorstore import QdrantStore
from packages.llm import OllamaClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="Semantic MCP Server")

# Global instances
vector_store: QdrantStore | None = None
ollama_client: OllamaClient | None = None


@app.on_event("startup")
async def startup():
    """Initialize vector store and embeddings."""
    global vector_store, ollama_client

    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    embed_model = os.environ.get("EMBED_MODEL", "embeddinggemma:300m")

    logger.info(f"Connecting to Qdrant at {qdrant_url}")
    vector_store = QdrantStore(url=qdrant_url)

    logger.info(f"Connecting to Ollama at {ollama_url}")
    ollama_client = OllamaClient(base_url=ollama_url)

    logger.info("Semantic server ready")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup."""
    if vector_store:
        await vector_store.close()
    if ollama_client:
        await ollama_client.close()


class ToolsListRequest(BaseModel):
    """Empty request for tools/list."""

    pass


class ToolCallRequest(BaseModel):
    """Tool call request."""

    name: str
    arguments: dict[str, Any]


@app.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}


@app.post("/tools/list")
async def list_tools(request: ToolsListRequest | None = None):
    """Return available tools."""
    return {
        "tools": [
            {
                "name": "query",
                "description": "Perform semantic search over ingested documents. Returns relevant document chunks with similarity scores.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Number of results to return",
                            "default": 5,
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional tags to filter by",
                        },
                        "collection": {
                            "type": "string",
                            "description": "Optional collection name (defaults to 'documents')",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "collections",
                "description": "List all available document collections in the vector store.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
        ]
    }


@app.post("/tools/call")
async def call_tool(request: ToolCallRequest):
    """Execute a tool."""
    tool_name = request.name
    arguments = request.arguments

    logger.info(f"Tool call: {tool_name} with args: {arguments}")

    if tool_name == "query":
        result = await semantic_query(
            query=arguments["query"],
            top_k=arguments.get("top_k", 5),
            tags=arguments.get("tags"),
            collection=arguments.get("collection"),
        )
    elif tool_name == "collections":
        result = await list_collections()
    else:
        result = {"error": f"Unknown tool: {tool_name}"}

    return {"content": [{"type": "text", "text": str(result)}]}


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7002)
