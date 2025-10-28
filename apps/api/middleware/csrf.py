"""CSRFMiddleware implements stateless double-submit token validation."""

from __future__ import annotations

import logging
import secrets
from typing import Iterable, Set

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from apps.api.csrf import CSRFTokenError, validate_csrf_token

logger = logging.getLogger(__name__)


class CSRFMiddleware(BaseHTTPMiddleware):
    """Validate CSRF tokens on unsafe HTTP methods."""

    SAFE_METHODS: Set[str] = {"GET", "HEAD", "OPTIONS", "TRACE"}

    def __init__(
        self,
        app: ASGIApp,
        *,
        header_name: str,
        cookie_name: str | None,
        exempt_paths: Iterable[str] | None = None,
        include_cookie_check: bool = True,
    ) -> None:
        super().__init__(app)
        self.header_name = header_name
        self.cookie_name = cookie_name
        self.include_cookie_check = include_cookie_check and bool(cookie_name)
        self.exempt_paths = self._normalize_paths(exempt_paths or ())

    @staticmethod
    def _normalize_paths(paths: Iterable[str]) -> Set[str]:
        normalized: Set[str] = set()
        for path in paths:
            if not path:
                continue
            normalized.add(path)
            normalized.add(path.rstrip("/") or "/")
        return normalized

    def _is_exempt(self, path: str) -> bool:
        if path in self.exempt_paths:
            return True
        normalized = path.rstrip("/") or "/"
        return normalized in self.exempt_paths

    def _reject(self, detail: str, code: str) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": detail, "code": code},
        )

    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] != "http":
            return await call_next(request)

        method = request.method.upper()
        path = request.url.path

        if method in self.SAFE_METHODS or self._is_exempt(path):
            return await call_next(request)

        header_token = request.headers.get(self.header_name)
        if not header_token:
            logger.debug("CSRF token header missing for %s %s", method, path)
            return self._reject("Missing CSRF token header", code="csrf_missing_header")

        if self.include_cookie_check:
            cookie_token = request.cookies.get(self.cookie_name or "")
            if not cookie_token:
                logger.debug("CSRF cookie missing for %s %s", method, path)
                return self._reject("Missing CSRF cookie", code="csrf_missing_cookie")

            if not secrets.compare_digest(cookie_token, header_token):
                logger.debug("CSRF token mismatch for %s %s", method, path)
                return self._reject("CSRF token mismatch", code="csrf_mismatch")

        try:
            token = validate_csrf_token(header_token)
        except CSRFTokenError as exc:
            logger.info("CSRF validation failed for %s %s: %s", method, path, exc)
            return self._reject(str(exc), code="csrf_invalid")

        request.state.csrf_token = token
        return await call_next(request)
