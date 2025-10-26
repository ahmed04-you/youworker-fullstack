"""
Common error handling decorators for API routes.
"""

import logging
from functools import wraps
from typing import Callable, Any

from fastapi import HTTPException
from httpx import HTTPStatusError


logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base exception for API errors."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.detail)


class ServiceUnavailableError(APIError):
    """Service unavailable error."""

    def __init__(self, detail: str = "Service unavailable"):
        super().__init__(status_code=503, detail=detail)


class ValidationError(APIError):
    """Validation error."""

    def __init__(self, detail: str = "Validation failed"):
        super().__init__(status_code=400, detail=detail)


def handle_exceptions(func: Callable) -> Callable:
    """
    Decorator to catch and handle general exceptions.
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except APIError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Internal server error")

    return wrapper


def format_error_response(
    error: str, code: int = 500, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Format an error response.
    """
    response = {
        "success": False,
        "error": error,
        "code": code,
    }
    if details:
        response["details"] = details
    return response


def handle_ollama_errors(func: Callable) -> Callable:
    """
    Decorator to handle Ollama-specific errors (HTTPStatusError, connection issues).
    Logs the error and raises HTTP 503.
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPStatusError as e:
            error_msg = f"Ollama API error ({e.response.status_code}): {e.response.text.strip()}"
            logger.error(error_msg, exc_info=True)
            raise HTTPException(status_code=503, detail=error_msg)
        except (ConnectionError, TimeoutError, OSError) as e:
            error_msg = f"Ollama connection error: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise HTTPException(status_code=503, detail=error_msg)

    return wrapper


def handle_audio_errors(func: Callable) -> Callable:
    """
    Decorator to handle audio processing errors (transcription, synthesis).
    Logs and raises appropriate HTTP exceptions.
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except RuntimeError as e:
            error_msg = f"Audio processing unavailable: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise HTTPException(status_code=503, detail=error_msg)
        except Exception as e:
            error_msg = f"Audio processing failed: {str(e)}"
            logger.warning(error_msg, exc_info=True)
            raise HTTPException(status_code=500, detail="Audio processing failed")

    return wrapper


def handle_general_llm_errors(func: Callable, default_status: int = 500) -> Callable:
    """
    Generic decorator for LLM-related errors.
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            error_msg = f"LLM processing error: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise HTTPException(status_code=default_status, detail=error_msg)

    return wrapper
