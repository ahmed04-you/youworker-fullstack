"""
Authentication endpoints for secure cookie-based auth.

Replaces the insecure NEXT_PUBLIC_API_KEY pattern with HttpOnly cookies.
"""

import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field

from apps.api.auth.security import (
    create_access_token,
    verify_api_key,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from apps.api.config import settings
from packages.db import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/auth", tags=["auth"])

security = HTTPBearer()


class LoginRequest(BaseModel):
    """Request body for login endpoint."""

    api_key: str = Field(..., description="API key for authentication", min_length=1)


class LoginResponse(BaseModel):
    """Response body for successful login."""

    message: str = "Login successful"
    username: str
    expires_in: int = Field(..., description="Token expiration time in seconds")


class LogoutResponse(BaseModel):
    """Response body for logout."""

    message: str = "Logout successful"


class MeResponse(BaseModel):
    """Response body for /me endpoint."""

    username: str
    is_root: bool
    authenticated: bool = True


def _extract_header_value(request: Request, header_name: str) -> str | None:
    """Attempt to extract header value by trying common casing variants."""
    if not header_name:
        return None

    candidates = {
        header_name,
        header_name.lower(),
        header_name.upper(),
        header_name.replace("_", "-"),
        header_name.lower().replace("_", "-"),
        header_name.upper().replace("_", "-"),
    }
    for candidate in candidates:
        value = request.headers.get(candidate)
        if value:
            return value
    return None


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    login_request: LoginRequest,
    response: Response,
) -> LoginResponse:
    """
    Authenticate with API key and receive HttpOnly cookie.

    This endpoint validates the API key and sets a secure HttpOnly cookie
    containing a JWT token. The cookie is automatically sent with subsequent
    requests, eliminating the need to expose the API key in the frontend.

    Security features:
    - HttpOnly: Cookie not accessible via JavaScript (XSS protection)
    - Secure: Cookie only sent over HTTPS in production
    - SameSite=Lax: CSRF protection
    - Short expiration: 30 minutes (configurable)
    """
    api_key = login_request.api_key.strip()

    # Verify API key
    if not verify_api_key(api_key):
        logger.warning("Failed login attempt with invalid API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": "root"},  # Username
        expires_delta=access_token_expires,
    )

    # Set HttpOnly cookie
    response.set_cookie(
        key="youworker_token",
        value=access_token,
        httponly=True,  # Not accessible via JavaScript
        secure=(settings.app_env == "production"),  # HTTPS only in production
        samesite="lax",  # CSRF protection
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
        path="/",
    )

    logger.info("User 'root' authenticated successfully")

    return LoginResponse(
        username="root",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/auto-login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def auto_login(request: Request, response: Response) -> LoginResponse:
    """
    Authenticate automatically using headers forwarded from Authentik.

    Authentik should inject a per-user API key header. In development environments,
    the root API key is used as a fallback to simplify local testing.
    """
    if not settings.authentik_enabled and settings.app_env == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Authentik disabled")

    header_value = _extract_header_value(request, settings.authentik_header_name)

    if not header_value and settings.app_env != "production":
        # Development fallback allows local testing without Authentik in front
        header_value = settings.root_api_key

    if not header_value:
        logger.warning("Authentik auto-login attempted without API key header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentik API key header missing",
        )

    if not verify_api_key(header_value):
        logger.warning("Authentik auto-login received invalid API key")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    username = "root"

    if settings.authentik_forward_user_header:
        forwarded_username = _extract_header_value(request, settings.authentik_forward_user_header)
        if forwarded_username:
            username = forwarded_username

    access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires,
    )

    response.set_cookie(
        key="youworker_token",
        value=access_token,
        httponly=True,
        secure=(settings.app_env == "production"),
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    logger.info("Authentik auto-login succeeded for user '%s'", username)

    return LoginResponse(username=username, expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/logout", response_model=LogoutResponse)
async def logout(response: Response) -> LogoutResponse:
    """
    Logout and clear authentication cookie.

    Removes the HttpOnly cookie, effectively logging out the user.
    """
    response.delete_cookie(
        key="youworker_token",
        path="/",
        httponly=True,
        secure=(settings.app_env == "production"),
        samesite="lax",
    )

    logger.info("User logged out successfully")

    return LogoutResponse()


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> MeResponse:
    """
    Get current authenticated user information.

    Requires valid authentication (cookie or API key).
    """
    return MeResponse(
        username=current_user.username,
        is_root=current_user.is_root,
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
) -> LoginResponse:
    """
    Refresh authentication token.

    Extends the session by issuing a new JWT token with a fresh expiration.
    """
    # Create new JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.username},
        expires_delta=access_token_expires,
    )

    # Update HttpOnly cookie
    response.set_cookie(
        key="youworker_token",
        value=access_token,
        httponly=True,
        secure=(settings.app_env == "production"),
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    logger.info(f"Token refreshed for user '{current_user.username}'")

    return LoginResponse(
        username=current_user.username,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
