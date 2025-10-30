"""
FastAPI backend for AI agent with dynamic MCP tools.

Main application entry point with modular route organization.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from jose import jwt, JWTError

from apps.api.config import settings
from apps.api.middleware import (
    CSRFMiddleware,
    IPWhitelistMiddleware,
    get_ip_whitelist_from_env,
    parse_and_validate_cors_origins,
)
from packages.llm import OllamaClient
from packages.agent import MCPRegistry, AgentLoop
from packages.vectorstore import QdrantStore
from packages.db import init_db as init_database
from packages.ingestion import IngestionPipeline
from packages.common import correlation_id_var, set_correlation_id
from packages.common.logger import configure_json_logging
from packages.common.exceptions import (
    YouWorkerException,
    ResourceNotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    DatabaseError,
    ExternalServiceError,
)

# Import route modules
from apps.api.routes.chat import router as chat_router
from apps.api.routes.websocket import router as websocket_router
from apps.api.routes.analytics import router as analytics_router
from apps.api.routes.auth import router as auth_router
from apps.api.routes.account import router as account_router
from apps.api.routes.groups import router as groups_router
from apps.api.routes import ingestion, crud, health

from .services.startup import StartupService


# Configure structured logging
# Use JSON logging in production for better observability
enable_json_logs = settings.app_env == "production"
configure_json_logging(log_level=settings.log_level, enable_json=enable_json_logs)

logger = logging.getLogger(__name__)


# No global instances - use app.state exclusively


def get_user_identifier(request: Request) -> str:
    """
    Get user identifier for rate limiting.

    Returns:
        - "user:{user_id}" for authenticated requests
        - IP address for unauthenticated requests

    This allows per-user rate limiting for authenticated users while
    still applying IP-based limits for anonymous requests.
    """
    # First, check if user is already in request state (from dependency injection)
    user = getattr(request.state, "user", None)
    if user:
        return f"user:{user.id}"

    # Try to extract user from JWT cookie (without full validation)
    youworker_token = request.cookies.get("youworker_token")
    if youworker_token:
        try:
            secret = settings.jwt_secret or settings.root_api_key
            payload = jwt.decode(youworker_token, secret, algorithms=["HS256"], options={"verify_exp": False})
            username = payload.get("sub")
            if username:
                # Use username as identifier (more stable than user_id which requires DB lookup)
                return f"user:{username}"
        except JWTError:
            # Invalid token, fall back to IP
            pass

    # Try Authentik header
    authentik_username = request.headers.get("X-Authentik-Username")
    if authentik_username:
        return f"user:{authentik_username}"

    # Fall back to IP-based rate limiting
    return get_remote_address(request)


# Rate limiter configuration with user-based limiting
limiter = Limiter(key_func=get_user_identifier, default_limits=["100/minute"])

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

# Configure rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore


# Global exception handlers for structured error responses
@app.exception_handler(YouWorkerException)
async def youworker_exception_handler(request: Request, exc: YouWorkerException):
    """Handle application-specific exceptions with structured error responses."""

    # Map exception types to HTTP status codes
    status_code_map = {
        ResourceNotFoundError: 404,
        ValidationError: 400,
        AuthenticationError: 401,
        AuthorizationError: 403,
        DatabaseError: 500,
        ExternalServiceError: 502,
    }

    status_code = status_code_map.get(type(exc), 500)

    # Log server errors (5xx)
    if status_code >= 500:
        logger.error(
            f"Server error: {exc.message}",
            extra={
                "exception_type": type(exc).__name__,
                "code": exc.code,
                "details": exc.details,
                "correlation_id": correlation_id_var.get(""),
                "path": request.url.path,
                "method": request.method,
            },
            exc_info=True,
        )
    else:
        # Log client errors (4xx) at info level
        logger.info(
            f"Client error: {exc.message}",
            extra={
                "exception_type": type(exc).__name__,
                "code": exc.code,
                "details": exc.details,
                "correlation_id": correlation_id_var.get(""),
                "path": request.url.path,
                "method": request.method,
            },
        )

    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.code,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    correlation_id = correlation_id_var.get("")

    logger.error(
        f"Unhandled exception: {str(exc)}",
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "exception_type": type(exc).__name__,
        },
        exc_info=True,
    )

    # Don't expose internal errors in production
    message = (
        str(exc) if settings.app_env == "development"
        else "An internal error occurred"
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": message,
                "code": "INTERNAL_ERROR",
                "correlation_id": correlation_id,
            }
        },
    )


# Validate and sanitize CORS origins with strict security checks
allowed_origins = parse_and_validate_cors_origins(settings.frontend_origin)
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
# Note: auto-login is exempt because it's the initial SSO authentication step
app.add_middleware(
    CSRFMiddleware,
    header_name=settings.csrf_header_name,
    cookie_name=settings.csrf_cookie_name,
    exempt_paths={"/v1/auth/csrf-token", "/v1/auth/auto-login"},
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
    set_correlation_id(correlation_id)

    # Process request
    response = await call_next(request)

    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id

    return response


@app.middleware("http")
async def add_api_version(request: Request, call_next):
    """
    API versioning middleware.

    Supports both URL-based versioning (/v1/endpoint) and header-based versioning.
    The API version is stored in request.state for use by endpoints if needed.

    Header: X-API-Version (optional, defaults to "v1")
    URL: /v1/endpoint (preferred method)

    Future versions can be added by:
    1. Creating new route modules with version-specific logic
    2. Including them with app.include_router(v2_router, prefix="/v2")
    3. Updating this middleware to handle version-specific features
    """
    # Get API version from header (fallback to v1)
    api_version = request.headers.get("X-API-Version", "v1")

    # Validate version format
    if not api_version.startswith("v"):
        api_version = f"v{api_version}"

    # Store version in request state for endpoint access
    request.state.api_version = api_version

    # Process request
    response = await call_next(request)

    # Include API version in response headers for client awareness
    response.headers["X-API-Version"] = api_version

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
app.include_router(account_router)
app.include_router(groups_router)  # Group management endpoints


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
