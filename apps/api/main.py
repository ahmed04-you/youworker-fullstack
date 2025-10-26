"""
FastAPI backend for AI agent with dynamic MCP tools.

Main application entry point with modular route organization.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator

from apps.api.config import settings
from packages.llm import OllamaClient
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.db import init_db as init_database
from packages.ingestion import IngestionPipeline

# Import route modules
from apps.api.routes.chat import router as chat_router
from apps.api.routes.websocket import router as websocket_router
from apps.api.routes.analytics import router as analytics_router
from apps.api.routes import ingestion, crud, health

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


# No global instances - use app.state exclusively

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""

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
    app.state.ollama_client = OllamaClient(
        base_url=settings.ollama_base_url,
        auto_pull=settings.ollama_auto_pull,
    )
    logger.info("Ollama client initialized")

    # Initialize vector store
    logger.info("Initializing vector store...")
    app.state.vector_store = QdrantStore(
        url=settings.qdrant_url,
        embedding_dim=settings.embedding_dim,
        default_collection=settings.qdrant_collection,
    )
    logger.info("Vector store initialized")

    # Initialize ingestion pipeline
    app.state.ingestion_pipeline = IngestionPipeline(settings=settings)  # type: ignore

    # Parse MCP server URLs
    logger.info("Parsing MCP server URLs...")
    mcp_server_configs = []
    if settings.mcp_server_urls:

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
    app.state.registry = MCPRegistry(server_configs=mcp_server_configs)

    # Connect to all MCP servers and discover tools
    logger.info("About to connect to MCP servers...")
    try:
        await app.state.registry.connect_all()
        logger.info(f"Connected to {len(app.state.registry.clients)} MCP servers")

        # Persist MCP servers and tools on refresh
        async def persist_registry(tools: dict[str, Any], clients: dict[str, Any]):
            from packages.db import get_async_session
            from packages.db.crud import upsert_mcp_servers, upsert_tools

            async with get_async_session() as db:
                # Servers
                servers = []
                for sid, client in clients.items():
                    servers.append(
                        (
                            sid,
                            client.ws_url.replace("ws://", "http://").replace("wss://", "https://"),
                            client.is_healthy,
                        )
                    )
                smap = await upsert_mcp_servers(db, servers)
                # Tools
                tool_rows = []
                for qname, tool in tools.items():
                    tool_rows.append((tool.server_id, qname, tool.description, tool.input_schema))
                await upsert_tools(db, smap, tool_rows)

        app.state.registry.set_refreshed_callback(persist_registry)
        # Trigger initial persist now
        await persist_registry(app.state.registry.tools, app.state.registry.clients)
        # Start periodic refresh of tools
        refresh_interval = max(0, settings.mcp_refresh_interval)
        await app.state.registry.start_periodic_refresh(interval_seconds=refresh_interval)
    except (ConnectionError, TimeoutError, OSError) as e:
        logger.error(f"Failed to connect to MCP servers: {e}")
        # Continue anyway - some servers may be unavailable

    # Initialize agent loop
    app.state.agent_loop = AgentLoop(
        ollama_client=app.state.ollama_client,
        registry=app.state.registry,
        model=settings.chat_model,
        default_language=settings.agent_default_language,
    )

    logger.info("API service ready")

    yield

    # Cleanup
    logger.info("Shutting down API service...")
    if app.state.ollama_client:
        await app.state.ollama_client.close()
    if app.state.registry:
        await app.state.registry.stop_periodic_refresh()
        await app.state.registry.close_all()
    if app.state.vector_store:
        await app.state.vector_store.close()


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
        # Validate URL format with stricter checks
        parsed = urlparse(origin)
        if not (
            parsed.scheme in {"http", "https"}
            and parsed.netloc
            and not parsed.path
            and not parsed.params
            and not parsed.query
            and not parsed.fragment
        ):
            logger.warning(f"Invalid CORS origin format (must be scheme://host): {origin}")
            continue
        allowed_origins.append(origin)
    except Exception as e:
        logger.warning(f"Failed to parse CORS origin {origin}: {e}")
        continue

if not allowed_origins:
    raise ValueError("No valid CORS origins provided; check FRONTEND_ORIGIN setting")

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


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Attach basic security headers to every response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    return response


# Include route modules
app.include_router(health.router)
# WebSocket chat endpoint (no prefix to match /chat/{session_id})
app.include_router(websocket_router)
# HTTP chat endpoints (with /v1 prefix)
app.include_router(chat_router)
app.include_router(ingestion.router)
app.include_router(crud.router)
app.include_router(analytics_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
