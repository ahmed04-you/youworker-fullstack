"""
Middleware for applying validation schemas to API endpoints.
"""

import logging
from functools import wraps
from typing import Any, Callable, Dict, List

from fastapi import HTTPException

from packages.api.schemas.validation import (
    UnifiedChatRequest,
    VoiceTurnRequest,
    IngestRequest,
    ToolCallRequest,
    SearchRequest,
    SessionRequest,
)

logger = logging.getLogger(__name__)


class ValidationMiddleware:
    """Middleware for enhanced input validation."""

    @staticmethod
    def validate_unified_chat(request_data: Dict[str, Any]) -> UnifiedChatRequest:
        """Validate unified chat request data."""
        try:
            return UnifiedChatRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in unified chat: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")

    @staticmethod
    def validate_voice_turn(request_data: Dict[str, Any]) -> VoiceTurnRequest:
        """Validate voice turn request data."""
        try:
            return VoiceTurnRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in voice turn: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid audio data: {str(e)}")

    @staticmethod
    def validate_ingest(request_data: Dict[str, Any]) -> IngestRequest:
        """Validate ingestion request data."""
        try:
            return IngestRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in ingestion: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid ingestion request: {str(e)}")

    @staticmethod
    def validate_tool_call(request_data: Dict[str, Any]) -> ToolCallRequest:
        """Validate tool call request data."""
        try:
            return ToolCallRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in tool call: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid tool call: {str(e)}")

    @staticmethod
    def validate_search(request_data: Dict[str, Any]) -> SearchRequest:
        """Validate search request data."""
        try:
            return SearchRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in search: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid search request: {str(e)}")

    @staticmethod
    def validate_session(request_data: Dict[str, Any]) -> SessionRequest:
        """Validate session request data."""
        try:
            return SessionRequest(**request_data)
        except Exception as e:
            logger.error(f"Validation error in session: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid session request: {str(e)}")


def with_validation(validator_func: Callable[[Dict[str, Any]], Any]):
    """
    Decorator for applying validation to endpoint functions.

    Args:
        validator_func: Function that validates request data

    Returns:
        Decorated function
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Extract request data from kwargs
            request_data = kwargs.get("request_data")
            if not request_data:
                raise HTTPException(status_code=400, detail="Request data is required")

            # Validate request data
            try:
                validated_data = validator_func(request_data)
                # Replace request_data with validated data
                kwargs["request_data"] = validated_data
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Unexpected validation error: {e}")
                raise HTTPException(
                    status_code=500, detail="Internal server error during validation"
                )

        return wrapper

    return decorator


def validate_batch_request(
    request_data: Dict[str, Any], max_items: int = 100
) -> List[Dict[str, Any]]:
    """
    Validate batch request data.

    Args:
        request_data: Request data containing items
        max_items: Maximum number of items allowed

    Returns:
        Validated items list

    Raises:
        HTTPException: If validation fails
    """
    if "items" not in request_data:
        raise HTTPException(status_code=400, detail="Batch request must contain 'items' field")

    items = request_data["items"]
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="'items' must be a list")

    if len(items) > max_items:
        raise HTTPException(status_code=400, detail=f"Too many items. Maximum allowed: {max_items}")

    return items


def sanitize_input(text: str, max_length: int = 1000) -> str:
    """
    Sanitize text input to prevent injection attacks.

    Args:
        text: Text to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized text
    """
    if not isinstance(text, str):
        return ""

    # Truncate to max length
    text = text[:max_length]

    # Remove potentially dangerous characters
    dangerous_chars = ["<", ">", '"', "'", "/", "\\", ";", "|", "&"]
    for char in dangerous_chars:
        text = text.replace(char, "")

    return text.strip()


def validate_file_upload(file_data: Dict[str, Any], allowed_extensions: List[str]) -> bool:
    """
    Validate file upload data.

    Args:
        file_data: File data dictionary
        allowed_extensions: List of allowed file extensions

    Returns:
        True if valid, False otherwise
    """
    if not file_data or "filename" not in file_data:
        return False

    filename = file_data["filename"]
    if not isinstance(filename, str):
        return False

    # Check file extension
    extension = filename.lower().split(".")[-1]
    if extension not in allowed_extensions:
        return False

    # Check file size (max 10MB)
    if "size" in file_data and file_data["size"] > 10 * 1024 * 1024:
        return False

    return True


class RateLimitMiddleware:
    """Simple rate limiting middleware."""

    def __init__(self, max_requests: int = 100, time_window: int = 60):
        """
        Initialize rate limiter.

        Args:
            max_requests: Maximum requests per time window
            time_window: Time window in seconds
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests: Dict[str, List[float]] = {}

    def is_allowed(self, client_id: str) -> bool:
        """
        Check if client is allowed to make a request.

        Args:
            client_id: Client identifier (IP address, API key, etc.)

        Returns:
            True if allowed, False otherwise
        """
        import time

        now = time.time()

        # Clean old requests
        if client_id in self.requests:
            self.requests[client_id] = [
                req_time
                for req_time in self.requests[client_id]
                if now - req_time < self.time_window
            ]
        else:
            self.requests[client_id] = []

        # Check if under limit
        if len(self.requests[client_id]) < self.max_requests:
            self.requests[client_id].append(now)
            return True

        return False

    def get_rate_limit_headers(self, client_id: str) -> Dict[str, str]:
        """
        Get rate limit headers for response.

        Args:
            client_id: Client identifier

        Returns:
            Dictionary of rate limit headers
        """
        import time

        now = time.time()
        request_count = 0

        if client_id in self.requests:
            self.requests[client_id] = [
                req_time
                for req_time in self.requests[client_id]
                if now - req_time < self.time_window
            ]
            request_count = len(self.requests[client_id])

        return {
            "X-RateLimit-Limit": str(self.max_requests),
            "X-RateLimit-Remaining": str(max(0, self.max_requests - request_count)),
            "X-RateLimit-Reset": str(int(now + self.time_window)),
        }
