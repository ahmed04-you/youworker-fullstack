"""
CORS origin validation with strict security checks.
"""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse


# Valid hostname regex (RFC 1123 compliant)
VALID_HOSTNAME_REGEX = re.compile(
    r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
)


def validate_cors_origin(origin: str) -> bool:
    """
    Validate CORS origin with strict security checks.

    Validates that the origin:
    - Is a properly formatted URL
    - Uses http or https scheme only
    - Has a valid hostname (DNS name, IP address, or localhost)
    - Has no path, params, query, or fragment
    - Has valid port if specified

    Args:
        origin: The origin URL to validate (e.g., "https://example.com:8000")

    Returns:
        True if origin is valid, False otherwise

    Examples:
        >>> validate_cors_origin("https://example.com")
        True
        >>> validate_cors_origin("http://localhost:3000")
        True
        >>> validate_cors_origin("https://example.com/path")
        False
        >>> validate_cors_origin("ftp://example.com")
        False
    """
    if not origin or not isinstance(origin, str):
        return False

    try:
        parsed = urlparse(origin)

        # Scheme must be http or https
        if parsed.scheme not in {"http", "https"}:
            return False

        # Must have netloc (hostname)
        if not parsed.netloc:
            return False

        # Must not have path, params, query, or fragment
        if any([parsed.path, parsed.params, parsed.query, parsed.fragment]):
            return False

        # Validate hostname format (no underscores, valid DNS)
        hostname = parsed.netloc.split(':')[0] if ':' in parsed.netloc else parsed.netloc

        # Allow localhost and loopback addresses
        if hostname in {'localhost', '127.0.0.1', '[::1]'}:
            pass
        else:
            # Try to parse as IP address
            try:
                ipaddress.ip_address(hostname)
            except ValueError:
                # Not an IP, validate as hostname
                if not VALID_HOSTNAME_REGEX.match(hostname):
                    return False

        # Validate port if present
        if ':' in parsed.netloc:
            port_str = parsed.netloc.split(':')[-1]
            try:
                port = int(port_str)
                if not (1 <= port <= 65535):
                    return False
            except ValueError:
                return False

        return True

    except Exception:
        return False


def parse_and_validate_cors_origins(origins_str: str) -> list[str]:
    """
    Parse comma-separated CORS origins and validate each one.

    Args:
        origins_str: Comma-separated string of origins

    Returns:
        List of valid origins

    Raises:
        ValueError: If no valid origins are found
    """
    if not origins_str:
        raise ValueError("No CORS origins provided")

    valid_origins = []
    invalid_origins = []

    for origin in origins_str.split(","):
        origin = origin.strip()
        if not origin:
            continue

        if validate_cors_origin(origin):
            valid_origins.append(origin)
        else:
            invalid_origins.append(origin)

    if invalid_origins:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(
            f"Invalid CORS origins detected: {invalid_origins}. "
            "Expected format: https://example.com or http://localhost:3000"
        )

    if not valid_origins:
        raise ValueError(
            "No valid CORS origins provided; check FRONTEND_ORIGIN setting. "
            "Expected format: https://example.com or http://localhost:3000"
        )

    return valid_origins
