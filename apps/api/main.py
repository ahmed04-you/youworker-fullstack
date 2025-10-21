"""
FastAPI backend for AI agent with dynamic MCP tools.

Endpoints:
- POST /v1/chat: Streaming chat with tool calling
- POST /v1/ingest: Document ingestion
"""
import asyncio
from datetime import datetime
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from pydantic import BaseModel

from apps.api.config import settings
from packages.llm import OllamaClient, ChatMessage
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.db import init_db as init_database, get_async_session, ensure_root_user
from sqlalchemy.ext.asyncio import AsyncSession
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

    # Initialize database (fail hard if unavailable)
    await init_database(settings)

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
        from urllib.parse import urlparse

        def derive_server_id(raw_url: str) -> str:
            """Derive a stable server_id from a URL.

            Rules:
            - Use hostname if present, else last path segment
            - Strip common prefixes: 'mcp', 'mcp-', 'mcp_'
            - Strip port and surrounding slashes
            - Fallback to the entire hostname if nothing remains
            """
            try:
                parsed = urlparse(raw_url)
                host = (parsed.hostname or "").strip().strip("/")
                if host:
                    base = host
                else:
                    # e.g., ws:///mcp_web
                    base = parsed.path.strip("/") or raw_url

                # Remove common prefixes
                for prefix in ("mcp-", "mcp_", "mcp"):
                    if base.startswith(prefix):
                        base = base[len(prefix) :]
                        break

                # Final cleanup
                base = base.split(".")[0]  # drop domain if any
                base = base or (parsed.hostname or "server").split(".")[0]
                return base
            except Exception:
                return "server"

        for url in settings.mcp_server_urls.split(","):
            url = url.strip()
            if url:
                server_id = derive_server_id(url)
                mcp_server_configs.append({"server_id": server_id, "url": url})

    logger.info(f"Configured MCP servers: {mcp_server_configs}")

    # Initialize MCP registry
    registry = MCPRegistry(server_configs=mcp_server_configs)

    # Connect to all MCP servers and discover tools
    try:
        await registry.connect_all()
        logger.info(f"Connected to {len(registry.clients)} MCP servers")
        # Persist MCP servers and tools on refresh
        async def persist_registry(tools: dict[str, Any], clients: dict[str, Any]):
            from packages.db import get_async_session
            from packages.db.crud import upsert_mcp_servers, upsert_tools
            async with get_async_session() as db:
                # Servers
                servers = []
                for sid, client in clients.items():
                    servers.append((sid, client.ws_url.replace("ws://", "http://").replace("wss://", "https://"), client.is_healthy))
                smap = await upsert_mcp_servers(db, servers)
                # Tools
                tool_rows = []
                for qname, tool in tools.items():
                    tool_rows.append((tool.server_id, qname, tool.description, tool.input_schema))
                await upsert_tools(db, smap, tool_rows)

        registry.set_refreshed_callback(persist_registry)
        # Trigger initial persist now
        await persist_registry(registry.tools, registry.clients)
        # Start periodic refresh of tools
        refresh_interval = max(0, settings.mcp_refresh_interval)
        await registry.start_periodic_refresh(interval_seconds=refresh_interval)
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
        await registry.stop_periodic_refresh()
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


async def _get_current_user(x_api_key: str | None = Header(default=None)) -> dict[str, Any]:
    """Minimal API key auth for root user."""
    from packages.db.models import User
    from packages.db.crud import ensure_root_user
    if not settings.root_api_key:
        raise HTTPException(status_code=500, detail="Server missing ROOT API key")
    key = (x_api_key or "").strip()
    if key != settings.root_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    # Ensure root user exists
    async with get_async_session() as db:
        user = await ensure_root_user(db, username="root", api_key=settings.root_api_key)
        # Ensure root has access to default collection
        try:
            from packages.vectorstore.schema import DEFAULT_COLLECTION
            from packages.db.crud import grant_user_collection_access
            await grant_user_collection_access(db, user_id=user.id, collection_name=DEFAULT_COLLECTION)
        except Exception:
            pass
        return {"id": user.id, "username": user.username, "is_root": user.is_root}


@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest, current_user=Depends(_get_current_user)):
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
            # Add padding comment to force browser flush (browsers buffer small chunks)
            # Most browsers flush when they receive at least 2KB of data
            padding = ": " + (" " * 2048) + "\n"
            return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n{padding}\n"

        async def generate():
            """Generate SSE stream."""
            try:
                last_tool_run_id = [None]
                # Create or get chat session
                async with get_async_session() as db:
                    from packages.db.crud import get_or_create_session, add_message
                    cs = await get_or_create_session(
                        db,
                        user_id=current_user["id"],
                        external_id=request.session_id,
                        model=agent_loop.model,
                        enable_tools=request.enable_tools,
                    )
                    # Persist latest user message (the last one in the provided list)
                    if messages and messages[-1].role == "user":
                        await add_message(db, session_id=cs.id, role="user", content=messages[-1].content)

                async for event in agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                ):
                    # Persist tool runs
                    if event.get("event") == "tool":
                        data = event.get("data", {})
                        if data.get("status") == "start":
                            # Record start
                            async with get_async_session() as db:
                                from packages.db.crud import start_tool_run
                                tr = await start_tool_run(
                                    db,
                                    user_id=current_user["id"],
                                    session_id=None,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=datetime.fromisoformat(data.get("ts")),
                                )
                                last_tool_run_id[0] = tr.id
                        elif data.get("status") == "end":
                            async with get_async_session() as db:
                                from packages.db.crud import finish_tool_run
                                if last_tool_run_id[0] is not None:
                                await finish_tool_run(
                                    db,
                                    run_id=last_tool_run_id[0],
                                    status="success",
                                    end_ts=datetime.fromisoformat(data.get("ts")),
                                    latency_ms=int(data.get("latency_ms")) if data.get("latency_ms") is not None else None,
                                    result_preview=(data.get("result_preview") or None),
                                    tool_name=data.get("tool"),
                                )
                    elif event.get("event") == "done":
                        # Persist assistant final message
                        final = event.get("data", {}).get("final_text") or ""
                        async with get_async_session() as db:
                            from packages.db.crud import get_or_create_session, add_message
                            cs = await get_or_create_session(
                                db,
                                user_id=current_user["id"],
                                external_id=request.session_id,
                                model=agent_loop.model,
                                enable_tools=request.enable_tools,
                            )
                            await add_message(db, session_id=cs.id, role="assistant", content=final)
                    yield format_sse(event)
                    # Force immediate flush by yielding control to event loop
                    await asyncio.sleep(0)

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
        # Persist final assistant message and session update
        async with get_async_session() as db:
            from packages.db.crud import get_or_create_session, add_message
            cs = await get_or_create_session(
                db,
                user_id=current_user["id"],
                external_id=request.session_id,
                model=agent_loop.model,
                enable_tools=request.enable_tools,
            )
            await add_message(
                db,
                session_id=cs.id,
                role="assistant",
                content=final_text if final_text is not None else "".join(collected_chunks),
            )

        response_text = final_text if final_text is not None else "".join(collected_chunks)
        return {"content": response_text}


@app.post("/v1/ingest", response_model=IngestResponse)
async def ingest_endpoint(request: IngestRequest, current_user=Depends(_get_current_user)):
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

        # Persist ingestion run + documents
        try:
            from packages.db.crud import record_ingestion_run, upsert_document
            import hashlib
            started_at = datetime.now().astimezone()
            finished_at = datetime.now().astimezone()
            async with get_async_session() as db:
                await record_ingestion_run(
                    db,
                    user_id=current_user["id"],
                    target=request.path_or_url,
                    from_web=request.from_web,
                    recursive=request.recursive,
                    tags=request.tags or [],
                    collection=None,
                    totals_files=result.total_files,
                    totals_chunks=result.total_chunks,
                    errors=error_messages or [],
                    started_at=started_at,
                    finished_at=finished_at,
                    status="success" if not error_messages else "partial",
                )
                for f in (result.files or []):
                    uri = f.get("uri")
                    path = f.get("path")
                    basis = uri or path or ""
                    ph = hashlib.sha256(basis.encode("utf-8")).hexdigest() if basis else None
                    await upsert_document(
                        db,
                        path_hash=ph or "",
                        uri=uri,
                        path=path,
                        mime=f.get("mime"),
                        bytes_size=f.get("size_bytes"),
                        source="web" if request.from_web else "file",
                        tags=request.tags or [],
                        collection=None,
                    )
        except Exception as persist_exc:
            logger.error(f"Failed to persist ingestion run: {persist_exc}")

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
