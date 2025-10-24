"""
Centralized error handling utilities for the API.
"""

import logging
from functools import wraps
from typing import Any, Callable, TypeVar, ParamSpec

from fastapi import HTTPException
from httpx import HTTPStatusError

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


class APIError(Exception):
    """Base exception for API errors."""

    def __init__(self, message: str, status_code: int = 500, details: dict[str, Any] | None = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ServiceUnavailableError(APIError):
    """Raised when an external service is unavailable."""

    def __init__(self, service: str, message: str | None = None):
        super().__init__(
            message=message or f"{service} is currently unavailable",
            status_code=503,
            details={"service": service},
        )


class ValidationError(APIError):
    """Raised when input validation fails."""

    def __init__(self, field: str, message: str):
        super().__init__(
            message=f"Validation failed for {field}: {message}",
            status_code=400,
            details={"field": field},
        )


def format_error_response(error: Exception, assistant_language: str = "en") -> dict[str, Any]:
    """Format an error into a standardized response."""
    if isinstance(error, APIError):
        return {
            "status": "error",
            "error": error.message,
            "code": error.status_code,
            "details": error.details,
        }
    elif isinstance(error, HTTPStatusError):
        return {
            "status": "error",
            "error": f"External service error ({error.response.status_code}): {error.response.text.strip()}",
            "code": error.response.status_code,
        }
    elif isinstance(error, HTTPException):
        return {
            "status": "error",
            "error": error.detail,
            "code": error.status_code,
        }
    else:
        return {
            "status": "error",
            "error": str(error),
            "code": 500,
        }


def handle_exceptions(
    log_error: bool = True,
    raise_http_exception: bool = False,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for handling exceptions in API endpoints.

    Args:
        log_error: Whether to log the error
        raise_http_exception: Whether to convert exceptions to HTTPException
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                # Re-raise FastAPI HTTPExceptions as-is
                raise
            except APIError as e:
                if log_error:
                    logger.error(f"{func.__name__} failed: {e.message}", exc_info=True)
                if raise_http_exception:
                    raise HTTPException(status_code=e.status_code, detail=e.message)
                raise
            except HTTPStatusError as e:
                error_msg = f"External service error ({e.response.status_code}): {e.response.text.strip()}"
                if log_error:
                    logger.error(f"{func.__name__} failed: {error_msg}")
                if raise_http_exception:
                    raise HTTPException(status_code=e.response.status_code, detail=error_msg)
                raise
            except Exception as e:
                if log_error:
                    logger.error(f"{func.__name__} failed: {str(e)}", exc_info=True)
                if raise_http_exception:
                    raise HTTPException(status_code=500, detail=str(e))
                raise

        @wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            try:
                return func(*args, **kwargs)
            except HTTPException:
                raise
            except APIError as e:
                if log_error:
                    logger.error(f"{func.__name__} failed: {e.message}", exc_info=True)
                if raise_http_exception:
                    raise HTTPException(status_code=e.status_code, detail=e.message)
                raise
            except HTTPStatusError as e:
                error_msg = f"External service error ({e.response.status_code}): {e.response.text.strip()}"
                if log_error:
                    logger.error(f"{func.__name__} failed: {error_msg}")
                if raise_http_exception:
                    raise HTTPException(status_code=e.response.status_code, detail=error_msg)
                raise
            except Exception as e:
                if log_error:
                    logger.error(f"{func.__name__} failed: {str(e)}", exc_info=True)
                if raise_http_exception:
                    raise HTTPException(status_code=500, detail=str(e))
                raise

        # Return appropriate wrapper based on whether function is async
        import inspect

        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        else:
            return sync_wrapper  # type: ignore

    return decorator
