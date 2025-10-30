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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from packages.db import get_async_session, get_user_by_api_key, User
from packages.db.crud import ensure_root_user as _ensure_root_user_impl

ensure_root_user = _ensure_root_user_impl

logger = logging.getLogger(__name__)

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# HTTP Bearer scheme
security = HTTPBearer(auto_error=False)


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
        token = youworker_token

        # Try JWT authentication from cookie
        if token:
            try:
                secret = settings.jwt_secret or settings.root_api_key
                payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
                username = payload.get("sub")

                if username:
                    user = await _ensure_root_user_impl(
                        session=db, username=username, api_key=settings.root_api_key
                    )
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
            username = authentik_username or "root"

            if not await _verify_api_key_with_session(db, authentik_api_key):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid Authentik credentials"
                )

            user = await _ensure_root_user_impl(
                session=db,
                username=username,
                api_key=authentik_api_key
            )
            if user:
                return user

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
        token = youworker_token

        # Try JWT authentication from cookie
        if token:
            try:
                secret = settings.jwt_secret or settings.root_api_key
                payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
                username = payload.get("sub")

                if username:
                    user = await _ensure_root_user_impl(
                        session=db, username=username, api_key=settings.root_api_key
                    )
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
            username = authentik_username or "root"
            if await _verify_api_key_with_session(db, authentik_api_key):
                user = await _ensure_root_user_impl(
                    session=db,
                    username=username,
                    api_key=authentik_api_key
                )
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


async def _verify_api_key_with_session(session: AsyncSession, api_key: str) -> bool:
    """
    Verify an API key using the provided database session.
    """
    if not api_key:
        return False

    # Try to find user by API key in database
    try:
        user = await get_user_by_api_key(session, api_key)
        if user:
            return True
    except Exception:
        # User not found in database, continue to fallback logic
        pass

    # Check if there's a root user with a stored hash
    stored_hash_result = await session.execute(
        select(User.api_key_hash).where(User.is_root.is_(True)).limit(1)
    )
    stored_hash = stored_hash_result.scalar_one_or_none()

    if stored_hash:
        # Root user exists with a hash, so don't allow plaintext fallback
        return False

    # No users in DB with this key, and no root user with hash
    # Fall back to comparing with ROOT_API_KEY from settings
    return bool(settings.root_api_key and secrets.compare_digest(api_key, settings.root_api_key))


async def verify_api_key(api_key: str) -> bool:
    """
    Verify an API key using a dedicated database session.
    """
    async with get_async_session() as session:
        return await _verify_api_key_with_session(session, api_key)


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
