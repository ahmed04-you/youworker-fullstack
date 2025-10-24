"""
Security middleware including CSP headers with nonce-based policies.
"""

import secrets
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class CSPMiddleware(BaseHTTPMiddleware):
    """
    Content Security Policy middleware with nonce-based policies.

    Generates a unique nonce for each request and adds CSP headers to prevent XSS attacks.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        report_only: bool = False,
        report_uri: str | None = None,
        enable_strict_csp: bool = True,
    ):
        super().__init__(app)
        self.report_only = report_only
        self.report_uri = report_uri
        self.enable_strict_csp = enable_strict_csp

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate nonce for this request
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce

        # Process request
        response = await call_next(request)

        # Skip CSP for non-HTML responses
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("text/html"):
            return response

        # Build CSP policy
        if self.enable_strict_csp:
            policy = self._build_strict_policy(nonce)
        else:
            policy = self._build_basic_policy(nonce)

        # Add CSP header
        header_name = "Content-Security-Policy-Report-Only" if self.report_only else "Content-Security-Policy"
        response.headers[header_name] = policy

        return response

    def _build_strict_policy(self, nonce: str) -> str:
        """Build a strict CSP policy."""
        directives = [
            f"default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}' 'strict-dynamic'",
            f"style-src 'self' 'nonce-{nonce}' 'unsafe-inline'",  # unsafe-inline needed for Tailwind
            f"img-src 'self' data: https:",
            f"font-src 'self' data:",
            f"connect-src 'self'",
            f"frame-ancestors 'self'",
            f"base-uri 'self'",
            f"form-action 'self'",
            f"upgrade-insecure-requests",
        ]

        if self.report_uri:
            directives.append(f"report-uri {self.report_uri}")

        return "; ".join(directives)

    def _build_basic_policy(self, nonce: str) -> str:
        """Build a basic CSP policy."""
        directives = [
            f"default-src 'self'",
            f"script-src 'self' 'nonce-{nonce}'",
            f"style-src 'self' 'nonce-{nonce}' 'unsafe-inline'",
            f"img-src 'self' data: https:",
            f"font-src 'self' data:",
        ]

        if self.report_uri:
            directives.append(f"report-uri {self.report_uri}")

        return "; ".join(directives)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security headers middleware.

    Adds various security headers to protect against common vulnerabilities.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = False,
    ):
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # X-Content-Type-Options: Prevent MIME type sniffing
        response.headers.setdefault("X-Content-Type-Options", "nosniff")

        # X-Frame-Options: Prevent clickjacking
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")

        # X-XSS-Protection: Enable XSS filter (legacy browsers)
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")

        # Referrer-Policy: Control referrer information
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        # Permissions-Policy: Control browser features
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=()",
        )

        # HSTS: Force HTTPS
        if self.enable_hsts and request.url.scheme == "https":
            hsts_value = f"max-age={self.hsts_max_age}"
            if self.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if self.hsts_preload:
                hsts_value += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_value

        return response


def setup_security_middleware(
    app: ASGIApp,
    enable_csp: bool = True,
    csp_report_only: bool = False,
    **kwargs,
) -> ASGIApp:
    """
    Setup all security middleware.

    Args:
        app: ASGI application
        enable_csp: Whether to enable CSP middleware
        csp_report_only: Whether CSP should be report-only
        **kwargs: Additional arguments for middleware

    Returns:
        App with middleware applied
    """
    # Add security headers
    app = SecurityHeadersMiddleware(app, **kwargs)

    # Add CSP if enabled
    if enable_csp:
        app = CSPMiddleware(app, report_only=csp_report_only, **kwargs)

    return app
