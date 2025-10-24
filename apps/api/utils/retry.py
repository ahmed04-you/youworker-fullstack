"""
Retry mechanism utilities for external service calls.
"""

import asyncio
import logging
from functools import wraps
from typing import Callable, TypeVar, ParamSpec, Any

from httpx import HTTPStatusError, ConnectError, TimeoutException

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


def exponential_backoff(attempt: int, base_delay: float = 0.1, max_delay: float = 10.0) -> float:
    """
    Calculate exponential backoff delay.

    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds

    Returns:
        Delay in seconds
    """
    delay = base_delay * (2**attempt)
    return min(delay, max_delay)


def should_retry_error(error: Exception) -> bool:
    """
    Determine if an error is retryable.

    Args:
        error: Exception to check

    Returns:
        True if the error is retryable
    """
    # Retry on network errors
    if isinstance(error, (ConnectError, TimeoutException)):
        return True

    # Retry on 5xx server errors and 429 rate limit
    if isinstance(error, HTTPStatusError):
        return error.response.status_code >= 500 or error.response.status_code == 429

    return False


def retry_async(
    max_attempts: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 10.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
    should_retry: Callable[[Exception], bool] | None = None,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for retrying async functions with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts
        base_delay: Base delay for exponential backoff
        max_delay: Maximum delay between retries
        exceptions: Tuple of exception types to catch
        should_retry: Optional function to determine if error should be retried

    Usage:
        @retry_async(max_attempts=3)
        async def call_external_service():
            ...
    """
    retry_checker = should_retry or should_retry_error

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            last_exception: Exception | None = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    # Check if we should retry this error
                    if not retry_checker(e):
                        logger.warning(
                            f"{func.__name__} failed with non-retryable error: {e}"
                        )
                        raise

                    # Don't sleep on the last attempt
                    if attempt < max_attempts - 1:
                        delay = exponential_backoff(attempt, base_delay, max_delay)
                        logger.warning(
                            f"{func.__name__} failed (attempt {attempt + 1}/{max_attempts}), "
                            f"retrying in {delay:.2f}s: {e}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} failed after {max_attempts} attempts: {e}"
                        )

            # If we get here, all attempts failed
            if last_exception:
                raise last_exception
            raise RuntimeError(f"{func.__name__} failed after {max_attempts} attempts")

        return wrapper  # type: ignore

    return decorator


class RetryableClient:
    """
    Base class for clients that need retry functionality.

    Example:
        class MyClient(RetryableClient):
            async def fetch_data(self):
                return await self.retry(self._fetch_data_impl)

            async def _fetch_data_impl(self):
                # Implementation that may fail
                ...
    """

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 0.1,
        max_delay: float = 10.0,
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay

    async def retry(
        self,
        func: Callable[..., T],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        Execute a function with retry logic.

        Args:
            func: Function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from func

        Raises:
            Last exception if all retries fail
        """
        last_exception: Exception | None = None

        for attempt in range(self.max_attempts):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e

                if not should_retry_error(e):
                    raise

                if attempt < self.max_attempts - 1:
                    delay = exponential_backoff(attempt, self.base_delay, self.max_delay)
                    logger.warning(
                        f"{func.__name__} failed (attempt {attempt + 1}/{self.max_attempts}), "
                        f"retrying in {delay:.2f}s: {e}"
                    )
                    await asyncio.sleep(delay)

        if last_exception:
            raise last_exception
        raise RuntimeError(f"Failed after {self.max_attempts} attempts")
