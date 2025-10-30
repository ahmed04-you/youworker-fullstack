"""
CSRF token generation and validation utilities.

Implements a stateless, signed token that expires after a short TTL and
supports double-submit cookie validation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import ClassVar

from apps.api.config import settings
from packages.common.exceptions import ConfigurationError

logger = logging.getLogger(__name__)

_secret_warning_logged = False


class CSRFTokenError(ValueError):
    """Raised when CSRF token validation fails."""


def _resolve_secret() -> bytes:
    """
    Resolve the secret used for signing CSRF tokens.

    Preference order:
    1. settings.csrf_secret (recommended)
    2. settings.jwt_secret
    3. settings.root_api_key
    """
    global _secret_warning_logged

    secret = settings.csrf_secret or settings.jwt_secret or settings.root_api_key
    if not secret:
        raise ConfigurationError(
            "CSRF protection is enabled but CSRF_SECRET / JWT_SECRET is not configured."
        )

    if not settings.csrf_secret and not _secret_warning_logged:
        logger.warning(
            "CSRF_SECRET is not configured; falling back to JWT secret. "
            "Set CSRF_SECRET in the environment for stronger isolation."
        )
        _secret_warning_logged = True

    return secret.encode("utf-8")


def ensure_csrf_secret() -> None:
    """Validate that a CSRF secret is configured."""
    _resolve_secret()


@dataclass(frozen=True, slots=True)
class CSRFToken:
    """Representation of an issued CSRF token."""

    value: str
    issued_at: datetime
    expires_at: datetime

    HEADER_NAME: ClassVar[str] = "X-CSRF-Token"
    DEFAULT_TTL_SECONDS: ClassVar[int] = 3600

    @classmethod
    def issue(cls, ttl_seconds: int | None = None) -> "CSRFToken":
        """Create a new CSRF token."""
        secret = _resolve_secret()
        ttl = ttl_seconds or settings.csrf_token_ttl_seconds or cls.DEFAULT_TTL_SECONDS

        issued_at = datetime.now(timezone.utc)
        nonce = secrets.token_urlsafe(32)
        timestamp = str(int(issued_at.timestamp()))

        payload = f"{timestamp}:{nonce}"
        signature = hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        encoded = base64.urlsafe_b64encode(f"{payload}:{signature}".encode("utf-8")).decode("utf-8")

        expires_at = issued_at + timedelta(seconds=ttl)
        return cls(value=encoded, issued_at=issued_at, expires_at=expires_at)

    @classmethod
    def decode(cls, token: str, ttl_seconds: int | None = None) -> "CSRFToken":
        """Decode a token string into a CSRFToken instance."""
        secret = _resolve_secret()
        ttl = ttl_seconds or settings.csrf_token_ttl_seconds or cls.DEFAULT_TTL_SECONDS

        try:
            decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise CSRFTokenError("Invalid CSRF token encoding") from exc

        parts = decoded.split(":")
        if len(parts) != 3:
            raise CSRFTokenError("Invalid CSRF token structure")

        timestamp_str, nonce, provided_signature = parts
        payload = f"{timestamp_str}:{nonce}".encode("utf-8")
        expected_signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(provided_signature, expected_signature):
            raise CSRFTokenError("CSRF token signature mismatch")

        try:
            timestamp_int = int(timestamp_str)
        except ValueError as exc:
            raise CSRFTokenError("Invalid CSRF token timestamp") from exc

        issued_at = datetime.fromtimestamp(timestamp_int, tz=timezone.utc)
        expires_at = issued_at + timedelta(seconds=ttl)
        return cls(value=token, issued_at=issued_at, expires_at=expires_at)

    def is_expired(self, now: datetime | None = None) -> bool:
        """Return True if the token is expired."""
        reference = now or datetime.now(timezone.utc)
        return reference >= self.expires_at


def validate_csrf_token(token_str: str) -> CSRFToken:
    """
    Validate a CSRF token string.

    Returns the decoded CSRFToken if valid; raises CSRFTokenError otherwise.
    """
    token = CSRFToken.decode(token_str)
    if token.is_expired():
        raise CSRFTokenError("CSRF token expired")
    return token
