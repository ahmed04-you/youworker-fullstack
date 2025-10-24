"""
Security utilities for authentication and authorization.
"""

import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Header, Depends
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from packages.db import get_async_session
from packages.db.crud import ensure_root_user as _ensure_root_user_impl

ensure_root_user = _ensure_root_user_impl

logger = logging.getLogger(__name__)

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# HTTP Bearer scheme
security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
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
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get the current user from JWT token or API key.

    Supports both JWT tokens and API keys for backward compatibility.
    """
    user = None
    provided_api_key = x_api_key.strip() if isinstance(x_api_key, str) else None

    # Try JWT authentication first
    if authorization:
        try:
            # Extract token from "Bearer <token>" format
            scheme, _, token = authorization.partition(" ")
            if scheme.lower() == "bearer" and token:
                # Decode JWT token
                secret = settings.jwt_secret or settings.root_api_key
                payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
                username = payload.get("sub")

                if username:
                    user = await _ensure_root_user_impl(
                        session=db, username=username, api_key=settings.root_api_key
                    )
                    if user:
                        return user
            else:
                # Support raw API key in Authorization header for backward compatibility
                provided_api_key = authorization.strip()
        except JWTError as e:
            logger.warning(f"JWT authentication failed: {e}")
            # Fall back to API key authentication
        except ValueError as e:
            logger.warning(f"Authorization parsing failed: {e}")
            # Fall back to API key authentication

    # If JWT failed or not provided, try API key authentication
    if not user:
        api_key = provided_api_key
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Use constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(api_key, settings.root_api_key):
            raise HTTPException(status_code=401, detail="Invalid API key")

        user = await _ensure_root_user_impl(session=db, username="root", api_key=api_key)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    """
    Get the current active user.

    Raises HTTPException if user is not active.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="User account is inactive")
    return current_user


def verify_api_key(api_key: str) -> bool:
    """
    Verify an API key against the stored root key.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not api_key:
        return False

    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(api_key, settings.root_api_key)


def sanitize_input(input_str: str | None, max_length: int = 4000) -> str:
    """
    Sanitize user input to prevent injection attacks.

    Args:
        input_str: Input string to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized string
    """
    if not input_str:
        return ""

    if not isinstance(input_str, str):
        input_str = str(input_str)

    # Normalize whitespace and strip control characters (except common whitespace)
    sanitized = "".join(
        ch for ch in input_str if (32 <= ord(ch) <= 126) or ch in {"\n", "\r", "\t", " "}
    )

    # Remove simple script/style tags
    import re

    sanitized = re.sub(
        r"<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>",
        "",
        sanitized,
        flags=re.IGNORECASE | re.DOTALL,
    )

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

    # Check if path is within allowed directories
    allowed_dirs = [
        os.path.normpath(settings.ingest_upload_root),
        os.path.normpath(settings.ingest_examples_dir),
    ]

    for allowed_dir in allowed_dirs:
        if file_path.startswith(allowed_dir):
            return True

    return False
