"""
IP Whitelisting Middleware for on-premise deployment security.

Restricts API access to whitelisted IP addresses for production environment.
"""

import logging
from typing import Callable

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from apps.api.config import settings

logger = logging.getLogger(__name__)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """
    Middleware to restrict access to whitelisted IP addresses.

    In production (on-premise) mode, only allows access from configured
    whitelisted IPs. In development mode, allows all access.
    """

    def __init__(
        self,
        app: Callable,
        whitelisted_ips: list[str] | None = None,
        enabled: bool = True,
    ):
        super().__init__(app)
        self.whitelisted_ips = whitelisted_ips or []
        self.enabled = enabled and settings.app_env == "production"

        if self.enabled:
            logger.info(
                "IP Whitelist ENABLED",
                extra={"whitelisted_ips": self.whitelisted_ips, "enabled": True}
            )
        else:
            logger.info(
                "IP Whitelist DISABLED - Development mode",
                extra={"enabled": False, "reason": "development_mode"}
            )

    async def dispatch(self, request: Request, call_next):
        """Process the request and check IP whitelist."""

        # Skip IP check if disabled or in development
        if not self.enabled:
            return await call_next(request)

        # Get client IP from various headers (reverse proxy support)
        client_ip = self._get_client_ip(request)

        # Check if IP is whitelisted
        if not self._is_ip_allowed(client_ip):
            logger.warning(
                "Access denied from non-whitelisted IP",
                extra={
                    "client_ip": client_ip,
                    "whitelisted_ips": self.whitelisted_ips,
                    "action": "denied"
                }
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": "Access forbidden: IP address not whitelisted",
                    "client_ip": client_ip,
                },
            )

        # IP is allowed, proceed with request
        logger.debug(
            "Request from whitelisted IP",
            extra={"client_ip": client_ip, "action": "allowed"}
        )
        response = await call_next(request)
        return response

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP from request.

        Checks headers in order:
        1. X-Forwarded-For (proxy/load balancer)
        2. X-Real-IP (reverse proxy)
        3. request.client.host (direct connection)
        """
        # Check X-Forwarded-For header (may contain multiple IPs)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP (original client)
            return forwarded_for.split(",")[0].strip()

        # Check X-Real-IP header (reverse proxy)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Fallback to direct client host
        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _is_ip_allowed(self, client_ip: str) -> bool:
        """Check if IP is in whitelist."""
        if not self.whitelisted_ips:
            # No whitelist configured, deny all (fail-safe)
            return False

        # Support CIDR notation in the future, for now exact match
        return (
            client_ip in self.whitelisted_ips
            or "127.0.0.1" in self.whitelisted_ips
            or "localhost" in client_ip
        )


def get_ip_whitelist_from_env() -> list[str]:
    """
    Parse whitelisted IPs from environment variable.

    Returns:
        List of whitelisted IP addresses
    """
    whitelist_str = getattr(settings, "whitelisted_ips", "")
    if not whitelist_str:
        return []

    return [ip.strip() for ip in whitelist_str.split(",") if ip.strip()]
