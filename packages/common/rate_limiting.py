"""Per-endpoint rate limiting utilities and decorators."""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


# Common rate limit presets
class RateLimit:
    """Common rate limit configurations."""

    # Strict limits for sensitive operations
    VERY_STRICT = "5/minute"
    STRICT = "10/minute"

    # Moderate limits for regular API operations
    MODERATE = "30/minute"
    RELAXED = "60/minute"

    # High limits for read-heavy operations
    HIGH = "100/minute"
    VERY_HIGH = "200/minute"

    # Per-hour limits for expensive operations
    EXPENSIVE_HOURLY = "10/hour"
    MODERATE_HOURLY = "50/hour"
    HIGH_HOURLY = "100/hour"

    # Auth-specific
    AUTH_LOGIN = "10/minute"  # Prevent brute force
    AUTH_REGISTER = "5/hour"  # Prevent spam registrations
    PASSWORD_RESET = "3/hour"  # Prevent abuse

    # API key operations
    API_KEY_REGENERATE = "3/hour"  # Sensitive operation

    # File operations
    FILE_UPLOAD = "20/hour"  # Resource intensive
    FILE_DELETE = "30/minute"  # Moderate

    # Chat operations
    CHAT_MESSAGE = "60/minute"  # Regular chat usage
    CHAT_SESSION_CREATE = "30/hour"  # Prevent spam

    # Admin operations
    ADMIN_ACTION = "30/minute"  # Administrative tasks


def custom_rate_limit(
    limit: str,
    *,
    key_func: Callable[[Request], str] | None = None,
    scope: str | None = None,
    per_method: bool = False,
    methods: list[str] | None = None,
) -> Callable[[Any], Any]:
    """
    Decorator for per-endpoint rate limiting.

    Args:
        limit: Rate limit string (e.g., "10/minute", "100/hour")
        key_func: Custom key function for rate limiting (defaults to IP address)
        scope: Scope for the rate limit (defaults to endpoint path)
        per_method: Apply rate limit per HTTP method
        methods: List of HTTP methods to apply rate limit to

    Example:
        @router.post("/sensitive-action")
        @custom_rate_limit(RateLimit.STRICT)
        async def sensitive_action():
            ...

        @router.post("/api-key/regenerate")
        @custom_rate_limit(RateLimit.API_KEY_REGENERATE, per_method=True)
        async def regenerate_api_key():
            ...
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        # This is a marker decorator - actual rate limiting is handled by slowapi
        # through the Limiter instance in main.py
        func._rate_limit = limit  # type: ignore
        func._rate_limit_key_func = key_func  # type: ignore
        func._rate_limit_scope = scope  # type: ignore
        func._rate_limit_per_method = per_method  # type: ignore
        func._rate_limit_methods = methods  # type: ignore
        return func
    return decorator


def create_limiter(
    default_limits: list[str] | None = None,
    key_func: Callable[[Request], str] | None = None
) -> Limiter:
    """
    Create a rate limiter instance with custom configuration.

    Args:
        default_limits: Default rate limits to apply to all endpoints
        key_func: Key function for identifying clients (defaults to IP address)

    Returns:
        Configured Limiter instance

    Example:
        limiter = create_limiter(
            default_limits=["100/minute"],
            key_func=get_user_identifier
        )
    """
    if key_func is None:
        key_func = get_remote_address

    if default_limits is None:
        default_limits = ["100/minute"]

    return Limiter(key_func=key_func, default_limits=default_limits)


def get_user_identifier(request: Request) -> str:
    """
    Get user identifier for rate limiting.

    Uses authenticated username if available, otherwise falls back to IP address.
    This allows per-user rate limiting for authenticated users while using
    IP-based rate limiting for anonymous users.

    Args:
        request: FastAPI request object

    Returns:
        User identifier string
    """
    # Check for authenticated user from JWT cookie
    if hasattr(request.state, 'user') and request.state.user:
        username = getattr(request.state.user, 'username', None)
        if username:
            return f"user:{username}"

    # Check for Authentik SSO forwarded user header
    from packages.common import get_settings
    settings = get_settings()

    if settings.security.authentik_enabled and settings.security.authentik_forward_user_header:
        username = request.headers.get(settings.security.authentik_forward_user_header)
        if username:
            return f"user:{username}"

    # Fall back to IP-based rate limiting
    return get_remote_address(request)


# Pre-configured endpoint decorators for common use cases
def rate_limit_strict(func: Callable[..., Any]) -> Callable[..., Any]:
    """Apply strict rate limiting (10/minute) to endpoint."""
    return custom_rate_limit(RateLimit.STRICT)(func)


def rate_limit_auth(func: Callable[..., Any]) -> Callable[..., Any]:
    """Apply auth-specific rate limiting (10/minute) to endpoint."""
    return custom_rate_limit(RateLimit.AUTH_LOGIN)(func)


def rate_limit_file_upload(func: Callable[..., Any]) -> Callable[..., Any]:
    """Apply file upload rate limiting (20/hour) to endpoint."""
    return custom_rate_limit(RateLimit.FILE_UPLOAD)(func)


def rate_limit_admin(func: Callable[..., Any]) -> Callable[..., Any]:
    """Apply admin action rate limiting (30/minute) to endpoint."""
    return custom_rate_limit(RateLimit.ADMIN_ACTION)(func)
