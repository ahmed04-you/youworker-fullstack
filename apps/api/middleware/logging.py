"""
Request logging middleware with structured logging.
"""

import logging
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging all HTTP requests with timing and status information.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        log_request_body: bool = False,
        log_response_body: bool = False,
        exclude_paths: set[str] | None = None,
    ):
        super().__init__(app)
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body
        self.exclude_paths = exclude_paths or {"/health", "/metrics"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Extract request info
        request_id = request.headers.get("X-Correlation-ID", "unknown")
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown")

        # Start timer
        start_time = time.perf_counter()

        # Log request
        logger.info(
            f"Request started",
            extra={
                "correlation_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": str(request.query_params),
                "client_ip": client_ip,
                "user_agent": user_agent,
            },
        )

        # Process request
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log response
            logger.info(
                f"Request completed",
                extra={
                    "correlation_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )

            return response

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log error
            logger.error(
                f"Request failed",
                extra={
                    "correlation_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "duration_ms": round(duration_ms, 2),
                },
                exc_info=True,
            )

            raise


def setup_logging_middleware(app: ASGIApp, **kwargs) -> ASGIApp:
    """
    Setup request logging middleware.

    Args:
        app: ASGI application
        **kwargs: Additional arguments for RequestLoggingMiddleware

    Returns:
        App with middleware applied
    """
    return RequestLoggingMiddleware(app, **kwargs)
