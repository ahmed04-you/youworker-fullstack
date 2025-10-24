"""
Response formatting utilities for consistent API responses.
"""

import json
from typing import Any


def success_response(data: Any, message: str | None = None) -> dict[str, Any]:
    """Format a successful response."""
    response = {
        "success": True,
        "data": data,
    }
    if message:
        response["message"] = message
    return response


def error_response(error: str, code: int = 500, details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Format an error response."""
    response = {
        "success": False,
        "error": error,
        "code": code,
    }
    if details:
        response["details"] = details
    return response


def paginated_response(
    data: list[Any],
    page: int,
    page_size: int,
    total: int,
) -> dict[str, Any]:
    """Format a paginated response."""
    return {
        "success": True,
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


def sse_format(event: dict[str, Any], pad: bool = False) -> str:
    """
    Encode a Server-Sent Event (SSE) frame.

    Args:
        event: Event dictionary with 'event' and 'data' keys
        pad: Whether to add initial padding for connection setup

    Returns:
        Formatted SSE string
    """
    event_name = event.get("event", "message")
    payload = event.get("data", {})

    lines = [
        f"event: {event_name}",
        f"data: {json.dumps(payload, ensure_ascii=False)}",
    ]

    if pad:
        # Add padding to ensure buffering doesn't delay first event
        lines.append(": " + (" " * 2048))

    return "\n".join(lines) + "\n\n"
