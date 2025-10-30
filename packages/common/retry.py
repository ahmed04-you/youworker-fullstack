"""
Retry utilities with exponential backoff for external service calls.

Provides consistent retry logic for Ollama, Qdrant, MCP servers, and other external services.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Type, Callable, TypeVar, ParamSpec

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

# Type variables for generic decorator
P = ParamSpec("P")
T = TypeVar("T")

# Retryable exception types
RETRYABLE_EXCEPTIONS = (
    ConnectionError,
    TimeoutError,
    asyncio.TimeoutError,
    OSError,
)


def async_retry(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
    multiplier: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = RETRYABLE_EXCEPTIONS,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for async functions with exponential backoff retry.

    Args:
        max_attempts: Maximum retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 1.0)
        max_wait: Maximum wait time between retries in seconds (default: 10.0)
        multiplier: Exponential backoff multiplier (default: 2.0)
        exceptions: Tuple of exception types to retry on (default: RETRYABLE_EXCEPTIONS)

    Returns:
        Decorator function that adds retry logic to async functions

    Example:
        >>> @async_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
        ... async def call_external_api():
        ...     # API call that may fail
        ...     pass
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(
            multiplier=multiplier,
            min=min_wait,
            max=max_wait,
        ),
        retry=retry_if_exception_type(exceptions),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )


def sync_retry(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
    multiplier: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = RETRYABLE_EXCEPTIONS,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for synchronous functions with exponential backoff retry.

    Args:
        max_attempts: Maximum retry attempts (default: 3)
        min_wait: Minimum wait time between retries in seconds (default: 1.0)
        max_wait: Maximum wait time between retries in seconds (default: 10.0)
        multiplier: Exponential backoff multiplier (default: 2.0)
        exceptions: Tuple of exception types to retry on (default: RETRYABLE_EXCEPTIONS)

    Returns:
        Decorator function that adds retry logic to synchronous functions

    Example:
        >>> @sync_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
        ... def call_external_api():
        ...     # API call that may fail
        ...     pass
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(
            multiplier=multiplier,
            min=min_wait,
            max=max_wait,
        ),
        retry=retry_if_exception_type(exceptions),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
