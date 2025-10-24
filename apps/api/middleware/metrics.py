"""
Metrics collection middleware for monitoring API performance.
"""

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware for collecting request metrics.

    Tracks:
    - Request count by endpoint and method
    - Request duration by endpoint
    - Response status codes
    - Error rates
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        exclude_paths: set[str] | None = None,
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or set()

        # In-memory metrics (in production, use Prometheus or similar)
        self.request_count: dict[str, int] = {}
        self.request_duration: dict[str, list[float]] = {}
        self.status_codes: dict[int, int] = {}
        self.errors: dict[str, int] = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Create metric key
        metric_key = f"{request.method} {request.url.path}"

        # Start timer
        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            # Record metrics
            duration_ms = (time.perf_counter() - start_time) * 1000
            self._record_request(metric_key, duration_ms, response.status_code)

            return response

        except Exception as e:
            # Record error metrics
            duration_ms = (time.perf_counter() - start_time) * 1000
            self._record_request(metric_key, duration_ms, 500)
            self._record_error(metric_key, str(e))
            raise

    def _record_request(self, key: str, duration_ms: float, status_code: int) -> None:
        """Record request metrics."""
        # Count requests
        self.request_count[key] = self.request_count.get(key, 0) + 1

        # Track duration
        if key not in self.request_duration:
            self.request_duration[key] = []
        self.request_duration[key].append(duration_ms)

        # Track status codes
        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1

    def _record_error(self, key: str, error: str) -> None:
        """Record error metrics."""
        error_key = f"{key}:{error}"
        self.errors[error_key] = self.errors.get(error_key, 0) + 1

    def get_metrics(self) -> dict:
        """Get collected metrics."""
        return {
            "request_count": self.request_count,
            "request_duration": {
                k: {
                    "count": len(v),
                    "avg": sum(v) / len(v) if v else 0,
                    "min": min(v) if v else 0,
                    "max": max(v) if v else 0,
                }
                for k, v in self.request_duration.items()
            },
            "status_codes": self.status_codes,
            "errors": self.errors,
        }


def setup_metrics_middleware(app: ASGIApp, **kwargs) -> ASGIApp:
    """
    Setup metrics collection middleware.

    Args:
        app: ASGI application
        **kwargs: Additional arguments for MetricsMiddleware

    Returns:
        App with middleware applied
    """
    return MetricsMiddleware(app, **kwargs)
