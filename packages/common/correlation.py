"""
Correlation ID management for distributed tracing.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar


# Context variable for storing correlation ID across async tasks
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """
    Get current correlation ID from context or generate a new one.

    Returns:
        Correlation ID string (UUID format)

    Examples:
        >>> # In a request handler with correlation ID set
        >>> get_correlation_id()
        '550e8400-e29b-41d4-a716-446655440000'

        >>> # Outside request context, generates new ID
        >>> get_correlation_id()
        '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    """
    cid = correlation_id_var.get("")
    if not cid:
        cid = str(uuid.uuid4())
        correlation_id_var.set(cid)
    return cid


def set_correlation_id(correlation_id: str) -> None:
    """
    Set correlation ID in current context.

    Args:
        correlation_id: The correlation ID to set

    Examples:
        >>> set_correlation_id("550e8400-e29b-41d4-a716-446655440000")
    """
    correlation_id_var.set(correlation_id)


def clear_correlation_id() -> None:
    """
    Clear correlation ID from current context.

    Useful for cleanup in test scenarios.
    """
    correlation_id_var.set("")
