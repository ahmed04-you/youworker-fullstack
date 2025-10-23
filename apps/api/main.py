"""
FastAPI backend for AI agent with dynamic MCP tools.

Main application entry point with modular route organization.
"""
import asyncio
import json
import logging
import secrets
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator

from apps.api.config import settings
from apps.api.audio_pipeline import (
    FW_AVAILABLE as STT_AVAILABLE,
    PIPER_AVAILABLE as TTS_AVAILABLE,
    transcribe_audio_pcm16,
    synthesize_speech,
)
from packages.llm import OllamaClient
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.db import init_db as init_database
from packages.db.session import get_async_session
from packages.db.crud import ensure_root_user
from packages.ingestion import IngestionPipeline

# Import route modules
from apps.api.routes import chat, ingestion, crud, health, analytics

# Correlation ID context variable for request tracing
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


# Custom log formatter that includes correlation ID
class CorrelationIdFormatter(logging.Formatter):
    def format(self, record):
        correlation_id = correlation_id_var.get("")
        if correlation_id:
            record.correlation_id = correlation_id
        else:
            record.correlation_id = "N/A"
        return super().format(record)


# Configure structured logging with correlation ID
log_format = "%(asctime)s - %(name)s - %(levelname)s - [%(correlation_id)s] - %(message)s"
formatter = CorrelationIdFormatter(log_format)

# Configure root logger
handler = logging.StreamHandler()
handler.setFormatter(formatter)
root_logger = logging.getLogger()
root_logger.setLevel(settings.log_level)
root_logger.handlers = [handler]

logger = logging.getLogger(__name__)


# Global instances
ollama_client: OllamaClient | None = None
registry: MCPRegistry | None = None
agent_loop: AgentLoop | None = None
vector_store: QdrantStore | None = None
ingestion_pipeline: IngestionPipeline | None = None

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    global ollama_client, registry, agent_loop, vector_store, ingestion_pipeline

    logger.info("Starting up API service...")

    # Ensure ingestion directories exist
    from pathlib import Path
    for dir_path in [settings.ingest_upload_root, settings.ingest_examples_dir]:
        try:
            Path(dir_path).mkdir(parents=True, exist_ok=True)
            logger.info(f"Ensured directory exists: {dir_path}")
        except (OSError, PermissionError) as e:
            logger.warning(f"Could not create directory {dir_path}: {e}")

    # Initialize database (fail hard if unavailable)
    logger.info("Initializing database...")
    await init_database(settings)  # type: ignore
    logger.info("Database initialized")

    # Initialize Ollama client
    logger.info("Initializing Ollama client...")
    ollama_client = OllamaClient(
        base_url=settings.ollama_base_url,
        auto_pull=settings.ollama_auto_pull,
    )
    logger.info("Ollama client initialized")

    # Initialize vector store
    logger.info("Initializing vector store...")
    vector_store = QdrantStore(
        url=settings.qdrant_url,
        embedding_dim=settings.embedding_dim,
        default_collection=settings.qdrant_collection,
    )
    logger.info("Vector store initialized")

    # Initialize ingestion pipeline
    ingestion_pipeline = IngestionPipeline(settings=settings)  # type: ignore

    # Parse MCP server URLs
    logger.info("Parsing MCP server URLs...")
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
            except (ValueError, AttributeError):
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
    logger.info("About to connect to MCP servers...")
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
    except (ConnectionError, TimeoutError, OSError) as e:
        logger.error(f"Failed to connect to MCP servers: {e}")
        # Continue anyway - some servers may be unavailable

    # Initialize agent loop
    agent_loop = AgentLoop(
        ollama_client=ollama_client,
        registry=registry,
        model=settings.chat_model,
        default_language=settings.agent_default_language,
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

instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
)
instrumentator.instrument(app).expose(app, include_in_schema=False, should_gzip=True)

# Configure rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# Validate and sanitize CORS origins
allowed_origins = []
for origin in settings.frontend_origin.split(","):
    origin = origin.strip()
    if not origin:
        continue
    try:
        # Validate URL format
        parsed = urlparse(origin)
        if not parsed.scheme or not parsed.netloc:
            logger.warning(f"Invalid CORS origin format: {origin}")
            continue
        allowed_origins.append(origin)
    except Exception as e:
        logger.warning(f"Failed to parse CORS origin {origin}: {e}")
        continue

if not allowed_origins:
    allowed_origins = ["http://localhost:8000"]
    logger.warning("No valid CORS origins provided, using default: http://localhost:8000")

logger.info("CORS configured for origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Correlation ID middleware for request tracing
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    """
    Middleware that adds a correlation ID to each request.

    The correlation ID can be provided by the client via X-Correlation-ID header
    or will be auto-generated. It's included in all log messages and returned
    in the response headers for client-side correlation.
    """
    # Get or generate correlation ID
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    correlation_id_var.set(correlation_id)

    # Process request
    response = await call_next(request)

    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id

    return response


# Include route modules
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(ingestion.router)
app.include_router(crud.router)
app.include_router(analytics.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
