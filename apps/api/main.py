"""
FastAPI backend for AI agent with dynamic MCP tools.

Endpoints:
- POST /v1/chat: Streaming chat with tool calling
- POST /v1/ingest: Document ingestion
"""
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from pydantic import BaseModel

from apps.api.config import settings
from packages.llm import OllamaClient, ChatMessage
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.ingestion import IngestionPipeline

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Global instances
ollama_client: OllamaClient | None = None
registry: MCPRegistry | None = None
agent_loop: AgentLoop | None = None
vector_store: QdrantStore | None = None
ingestion_pipeline: IngestionPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    global ollama_client, registry, agent_loop, vector_store, ingestion_pipeline

    logger.info("Starting up API service...")

    # Initialize Ollama client
    ollama_client = OllamaClient(base_url=settings.ollama_base_url)

    # Initialize vector store
    vector_store = QdrantStore(
        url=settings.qdrant_url,
        embedding_dim=settings.embedding_dim,
        default_collection=settings.qdrant_collection,
    )

    # Initialize ingestion pipeline
    ingestion_pipeline = IngestionPipeline(settings=settings)

    # Parse MCP server URLs
    mcp_server_configs = []
    if settings.mcp_server_urls:
        for url in settings.mcp_server_urls.split(","):
            url = url.strip()
            if url:
                # Extract server ID from URL (e.g., "http://mcp_web:7001" -> "web")
                server_id = url.split("_")[-1].split(":")[0].replace("mcp", "").strip("/")
                if not server_id:
                    server_id = url.split("/")[-1]

                mcp_server_configs.append({"server_id": server_id, "url": url})

    logger.info(f"Configured MCP servers: {mcp_server_configs}")

    # Initialize MCP registry
    registry = MCPRegistry(server_configs=mcp_server_configs)

    # Connect to all MCP servers and discover tools
    try:
        await registry.connect_all()
        logger.info(f"Connected to {len(registry.clients)} MCP servers")
    except Exception as e:
        logger.error(f"Failed to connect to MCP servers: {e}")
        # Continue anyway - some servers may be unavailable

    # Initialize agent loop
    agent_loop = AgentLoop(
        ollama_client=ollama_client,
        registry=registry,
        model=settings.chat_model,
    )

    logger.info("API service ready")

    yield

    # Cleanup
    logger.info("Shutting down API service...")
    if ollama_client:
        await ollama_client.close()
    if registry:
        await registry.close_all()
    if vector_store:
        await vector_store.close()


# Create FastAPI app
app = FastAPI(
    title="AI Agent Backend",
    description="Production-ready AI agent with dynamic MCP tools",
    version="0.1.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in settings.frontend_origin.split(",")
    if origin.strip()
]
if not allowed_origins:
    allowed_origins = ["http://localhost:8000"]

logger.info("CORS configured for origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ChatRequest(BaseModel):
    """Chat request model."""

    messages: list[dict[str, str]]  # [{role, content}]
    session_id: str | None = None
    stream: bool = True
    enable_tools: bool = True
    model: str | None = None


class IngestRequest(BaseModel):
    """Ingestion request model."""

    path_or_url: str
    from_web: bool = False
    recursive: bool = False
    tags: list[str] | None = None


class IngestResponse(BaseModel):
    """Ingestion response model."""

    files_processed: int
    chunks_written: int
    files: list[dict[str, Any]] = []
    errors: list[str] | None = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    healthy_servers = registry.list_healthy_servers() if registry else []
    return {
        "status": "healthy",
        "mcp_servers": healthy_servers,
    }


@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Chat endpoint with streaming support and tool calling.

    IMPORTANT: This implements the strict single-tool stepper pattern.
    - Tool calls are executed internally
    - Only final answers are streamed to the client
    - Thinking traces are captured but NOT streamed
    """
    if not agent_loop:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    # Convert request messages to ChatMessage objects
    messages = []
    for msg in request.messages:
        messages.append(
            ChatMessage(
                role=msg.get("role", "user"),
                content=msg.get("content", ""),
            )
        )

    # Use specified model or default
    if request.model:
        agent_loop.model = request.model
    else:
        agent_loop.model = settings.chat_model

    logger.info(f"Chat request: {len(messages)} messages, tools={request.enable_tools}")

    if request.stream:
        # Streaming response

        def format_sse(event: dict[str, Any]) -> str:
            event_name = event.get("event", "message")
            payload = event.get("data", {})
            return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

        async def generate():
            """Generate SSE stream."""
            try:
                async for event in agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                ):
                    yield format_sse(event)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during chat: %s", error_msg)
                yield format_sse({"event": "log", "data": {"level": "error", "msg": error_msg}})
                yield format_sse(
                    {
                        "event": "done",
                        "data": {
                            "metadata": {"status": "error", "error": error_msg},
                            "final_text": f"Errore: {error_msg}",
                        },
                    }
                )
            except Exception as e:
                error_msg = str(e)
                logger.error("Error during chat: %s", error_msg)
                yield format_sse({"event": "log", "data": {"level": "error", "msg": error_msg}})
                yield format_sse(
                    {
                        "event": "done",
                        "data": {
                            "metadata": {"status": "error", "error": error_msg},
                            "final_text": f"Errore: {error_msg}",
                        },
                    }
                )

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    else:
        # Non-streaming response
        collected_chunks: list[str] = []
        final_text: str | None = None

        async for event in agent_loop.run_until_completion(
            messages=messages,
            enable_tools=request.enable_tools,
            max_iterations=settings.max_agent_iterations,
        ):
            if event.get("event") == "token":
                text = event.get("data", {}).get("text", "")
                collected_chunks.append(text)
            elif event.get("event") == "done":
                final_text = event.get("data", {}).get("final_text", final_text)

        response_text = final_text if final_text is not None else "".join(collected_chunks)
        return {"content": response_text}


@app.post("/v1/ingest", response_model=IngestResponse)
async def ingest_endpoint(request: IngestRequest):
    """
    Document ingestion endpoint.

    Accepts local paths or URLs, parses with Docling, and upserts to Qdrant.
    """
    if not ingestion_pipeline:
        raise HTTPException(status_code=503, detail="Ingestion pipeline not initialized")

    logger.info(f"Ingestion request: path={request.path_or_url}, tags={request.tags}")

    try:
        if request.from_web:
            # TODO: Implement web fetching
            raise HTTPException(status_code=501, detail="Web ingestion not yet implemented")

        # Ingest from local path
        result = await ingestion_pipeline.ingest_path(
            request.path_or_url,
            recursive=request.recursive,
            from_web=request.from_web,
            tags=request.tags,
        )

        error_messages = [
            f"{err.get('target')}: {err.get('error')}" if isinstance(err, dict) else str(err)
            for err in (result.errors or [])
        ]

        return IngestResponse(
            files_processed=result.total_files,
            chunks_written=result.total_chunks,
            files=[dict(file) for file in (result.files or [])],
            errors=error_messages or None,
        )

    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
