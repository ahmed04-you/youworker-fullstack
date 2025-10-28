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
from apps.api.middleware import (
    CSRFMiddleware,
    IPWhitelistMiddleware,
    get_ip_whitelist_from_env,
)
from packages.llm import OllamaClient
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.db import init_db as init_database
from packages.ingestion import IngestionPipeline

# Import route modules
from apps.api.routes.chat import router as chat_router
from apps.api.routes.websocket import router as websocket_router
from apps.api.routes.analytics import router as analytics_router
from apps.api.routes.auth import router as auth_router
from apps.api.routes import ingestion, crud, health

from .services.startup import StartupService

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

startup_service = StartupService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    await startup_service.initialize(app)
    yield
    await startup_service.shutdown(app)


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

# Add IP whitelist middleware for production security
whitelisted_ips = get_ip_whitelist_from_env()
app.add_middleware(
    IPWhitelistMiddleware,
    whitelisted_ips=whitelisted_ips,
    enabled=(settings.app_env == "production"),
)

# Enforce CSRF protection on state-changing requests
app.add_middleware(
    CSRFMiddleware,
    header_name=settings.csrf_header_name,
    cookie_name=settings.csrf_cookie_name,
    exempt_paths={"/v1/auth/csrf-token"},
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
app.include_router(auth_router)  # Authentication endpoints
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
