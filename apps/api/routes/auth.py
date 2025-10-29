"""
Authentication endpoints for secure cookie-based auth.

Replaces the insecure NEXT_PUBLIC_API_KEY pattern with HttpOnly cookies.
"""

import logging
from datetime import datetime, timedelta
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
from apps.api.csrf import CSRFToken
from packages.db import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/auth", tags=["auth"])

security = HTTPBearer()


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


class CSRFTokenResponse(BaseModel):
    """Response body for CSRF token endpoint."""

    csrf_token: str
    expires_at: datetime


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


@router.post("/auto-login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def auto_login(request: Request, response: Response) -> LoginResponse:
    """
    Authenticate using Authentik SSO headers.

    Authentik injects per-user authentication headers that are validated here.
    In development mode, simulated headers from nginx.conf are used.

    This is now the ONLY authentication method supported.
    """
    # Extract Authentik API key header
    header_value = _extract_header_value(request, settings.authentik_header_name)

    if not header_value:
        logger.warning("Authentik SSO header missing - authentication failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentik SSO required - no authentication header found",
        )

    # Verify the API key from Authentik
    if not await verify_api_key(header_value):
        logger.warning("Authentik SSO header contains invalid API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authentik credentials"
        )

    # Extract username from Authentik header (or default to 'root' for simulated dev env)
    username = "root"
    if settings.authentik_forward_user_header:
        forwarded_username = _extract_header_value(request, settings.authentik_forward_user_header)
        if forwarded_username:
            username = forwarded_username

    # Create JWT token for the session
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires,
    )

    # Set HttpOnly cookie with JWT
    response.set_cookie(
        key="youworker_token",
        value=access_token,
        httponly=True,
        secure=(settings.app_env == "production"),
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    logger.info("Authentik SSO authentication succeeded for user '%s'", username)

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


@router.get("/csrf-token", response_model=CSRFTokenResponse)
async def get_csrf_token(response: Response) -> CSRFTokenResponse:
    """
    Issue a CSRF token for double-submit validation.

    The token is signed and stored in both a cookie and JSON response.
    Clients should include the value in the X-CSRF-Token header for state-changing requests.
    """
    token = CSRFToken.issue()

    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=token.value,
        httponly=False,
        secure=(settings.app_env == "production"),
        samesite="strict",
        max_age=settings.csrf_token_ttl_seconds,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return CSRFTokenResponse(csrf_token=token.value, expires_at=token.expires_at)
