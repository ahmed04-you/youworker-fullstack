"""
Security utilities for authentication and authorization.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, Header, Depends, Cookie
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from packages.common.exceptions import ValidationError
from packages.db import get_async_session, User
from packages.db.repositories import UserRepository

logger = logging.getLogger(__name__)

# JWT Configuration
ALGORITHM = "HS256"
# Token expiration: 10 years (effectively unlimited for user sessions)
# Tokens are session-based and should persist until explicitly revoked
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365 * 10  # 10 years in minutes

# HTTP Bearer scheme
security = HTTPBearer(auto_error=False)

DEFAULT_AUTHENTIK_USERNAME = "root"
MAX_USERNAME_LENGTH = 128


def _normalize_username(username: str | None) -> str:
    """Normalize usernames received from Authentik headers."""
    normalized = (username or "").strip()
    if not normalized:
        normalized = DEFAULT_AUTHENTIK_USERNAME
    if len(normalized) > MAX_USERNAME_LENGTH:
        normalized = normalized[:MAX_USERNAME_LENGTH]
    return normalized


def _should_mark_user_root(username: str, api_key: str) -> bool:
    """Determine if the authenticated user should be treated as root."""
    if username == DEFAULT_AUTHENTIK_USERNAME:
        return True
    if settings.root_api_key:
        try:
            return secrets.compare_digest(api_key, settings.root_api_key)
        except Exception:
            return False
    return False


async def _ensure_user_for_api_key(
    session: AsyncSession,
    api_key: str,
    username: str | None = None,
) -> User | None:
    """Ensure we have a user associated with the provided API key."""
    if not api_key:
        logger.warning("API key verification failed: empty key")
        return None

    normalized_username = _normalize_username(username)
    user_repo = UserRepository(session)

    try:
        user = await user_repo.ensure_user_with_api_key(
            username=normalized_username,
            api_key=api_key,
            is_root=_should_mark_user_root(normalized_username, api_key),
        )
        return user
    except ValidationError as exc:
        logger.warning(
            "API key validation failed",
            extra={
                "error": str(exc),
                "error_type": type(exc).__name__,
                "username": normalized_username,
                "key_length": len(api_key),
            },
        )
    except Exception as exc:
        logger.error(
            "Failed to associate API key with user",
            extra={
                "error": str(exc),
                "error_type": type(exc).__name__,
                "username": normalized_username,
                "key_length": len(api_key),
            },
        )
    return None


async def authenticate_authentik_user(
    api_key: str,
    username: str | None = None,
) -> User | None:
    """Resolve the authenticated user from Authentik credentials."""
    async with get_async_session() as session:
        return await _ensure_user_for_api_key(session, api_key, username)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    secret = settings.jwt_secret or settings.root_api_key
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    youworker_token: str | None = Cookie(default=None),
    authentik_api_key: str | None = Header(default=None, alias="X-Authentik-Api-Key"),
    authentik_username: str | None = Header(default=None, alias="X-Authentik-Username"),
):
    """
    Get the current user from JWT cookie.

    This function only supports JWT token authentication from the HttpOnly cookie.
    The JWT token is issued after successful Authentik SSO authentication via /v1/auth/auto-login.

    Authentication flow:
    1. Check for JWT token in youworker_token cookie
    2. If no cookie but Authentik headers present, validate Authentik credentials
    3. Return user object if authenticated, raise 401 otherwise
    """
    async with get_async_session() as db:
        user_repo = UserRepository(db)
        token = youworker_token

        # Try JWT authentication from cookie
        if token:
            try:
                secret = settings.jwt_secret or settings.root_api_key
                payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
                username = payload.get("sub")

                if username:
                    normalized_username = _normalize_username(username)
                    user = await user_repo.get_by_username(normalized_username)
                    if user:
                        return user
            except JWTError as e:
                logger.warning(
                    "JWT authentication failed",
                    extra={"error": str(e), "error_type": type(e).__name__}
                )
                # Fall through to Authentik header check
            except ValueError as e:
                logger.warning(
                    "Token parsing failed",
                    extra={"error": str(e), "error_type": type(e).__name__}
                )
                # Fall through to Authentik header check

        # If JWT not present or invalid, check for Authentik headers (for direct API access)
        if authentik_api_key:
            user = await _ensure_user_for_api_key(db, authentik_api_key, authentik_username)
            if user:
                return user
            raise HTTPException(
                status_code=401,
                detail="Invalid Authentik credentials",
            )

        # No valid authentication found
        raise HTTPException(
            status_code=401,
            detail="Not authenticated - please authenticate via Authentik SSO",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    youworker_token: str | None = Cookie(default=None),
    authentik_api_key: str | None = Header(default=None, alias="X-Authentik-Api-Key"),
    authentik_username: str | None = Header(default=None, alias="X-Authentik-Username"),
):
    """
    Get the current user from JWT cookie, or None if no valid authentication.

    Same as get_current_user but returns None instead of raising HTTPException.
    """
    async with get_async_session() as db:
        user_repo = UserRepository(db)
        token = youworker_token

        # Try JWT authentication from cookie
        if token:
            try:
                secret = settings.jwt_secret or settings.root_api_key
                payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
                username = payload.get("sub")

                if username:
                    normalized_username = _normalize_username(username)
                    user = await user_repo.get_by_username(normalized_username)
                    if user:
                        return user
            except JWTError as e:
                logger.debug(
                    "JWT authentication failed",
                    extra={"error": str(e), "error_type": type(e).__name__}
                )
            except ValueError as e:
                logger.debug(
                    "Token parsing failed",
                    extra={"error": str(e), "error_type": type(e).__name__}
                )

        # Try Authentik headers
        if authentik_api_key:
            user = await _ensure_user_for_api_key(db, authentik_api_key, authentik_username)
            if user:
                return user

        return None


async def get_current_active_user(current_user=Depends(get_current_user)):
    """
    Get the current active user.

    Raises HTTPException if user is not active.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="User account is inactive")
    return current_user


async def verify_api_key(api_key: str, username: str | None = None) -> bool:
    """
    Verify an API key using a dedicated database session.
    """
    async with get_async_session() as session:
        user = await _ensure_user_for_api_key(session, api_key, username)
        return user is not None


def sanitize_input(input_str: str | None, max_length: int = 4000) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks.

    This function implements comprehensive XSS protection by:
    1. Removing control characters (except safe whitespace)
    2. Stripping dangerous HTML tags and attributes
    3. Removing JavaScript event handlers
    4. Blocking data: and javascript: URIs
    5. Enforcing maximum length

    Args:
        input_str: Input string to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized string safe for display

    Note:
        For production use with rich text, consider using bleach or DOMPurify
        on the client side for more sophisticated HTML sanitization.
    """
    if not input_str:
        return ""

    if not isinstance(input_str, str):
        input_str = str(input_str)

    import re

    # Normalize whitespace and strip control characters (except common whitespace)
    sanitized = "".join(
        ch for ch in input_str if (32 <= ord(ch) <= 126) or ch in {"\n", "\r", "\t", " "}
    )

    # Remove dangerous HTML tags (script, style, iframe, object, embed, etc.)
    dangerous_tags = [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "applet",
        "meta",
        "link",
        "base",
        "form",
        "input",
        "button",
    ]
    for tag in dangerous_tags:
        # Remove opening and closing tags with any attributes
        sanitized = re.sub(
            rf"<\s*{tag}[^>]*>.*?<\s*/\s*{tag}\s*>",
            "",
            sanitized,
            flags=re.IGNORECASE | re.DOTALL,
        )
        # Remove self-closing tags
        sanitized = re.sub(
            rf"<\s*{tag}[^>]*/\s*>",
            "",
            sanitized,
            flags=re.IGNORECASE,
        )

    # Remove JavaScript event handlers (onclick, onerror, onload, etc.)
    sanitized = re.sub(
        r'\s+on\w+\s*=\s*["\'][^"\']*["\']',
        "",
        sanitized,
        flags=re.IGNORECASE,
    )

    # Remove javascript: and data: URIs
    sanitized = re.sub(
        r"(javascript|data|vbscript):",
        "",
        sanitized,
        flags=re.IGNORECASE,
    )

    # Remove remaining HTML tags (convert to plain text)
    # Uncomment if you want to strip ALL HTML
    # sanitized = re.sub(r'<[^>]+>', '', sanitized)

    sanitized = sanitized.strip()

    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized


def validate_file_path(file_path: str) -> bool:
    """
    Validate file path to prevent directory traversal attacks.

    Args:
        file_path: File path to validate

    Returns:
        True if path is safe, False otherwise
    """
    if not file_path:
        return False

    # Normalize path
    import os

    file_path = os.path.normpath(file_path)

    # Check for directory traversal
    if ".." in file_path:
        return False

    # Ensure the resolved path stays within the upload root
    try:
        resolved_path = Path(file_path).resolve()
        upload_root = Path(settings.ingest_upload_root).resolve()
    except (OSError, RuntimeError):
        return False

    return resolved_path == upload_root or upload_root in resolved_path.parents
