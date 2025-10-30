"""
Unit tests for CORS validation (P0-5).

Tests the hardened CORS origin validation to ensure
it rejects malformed URLs and directory traversal attempts.
"""
from __future__ import annotations

import pytest

from apps.api.middleware.cors_validation import (
    validate_cors_origin,
    InvalidOriginError,
)


class TestCORSValidation:
    """Test CORS origin validation edge cases."""

    def test_valid_origins(self):
        """Test that valid origins are accepted."""
        valid_origins = [
            "http://localhost:3000",
            "https://example.com",
            "https://app.example.com",
            "http://192.168.1.100:8080",
            "https://example.com:443",
        ]

        for origin in valid_origins:
            assert validate_cors_origin(origin) is True

    def test_missing_scheme(self):
        """Test rejection of origins without http/https scheme."""
        with pytest.raises(InvalidOriginError, match="must start with http:// or https://"):
            validate_cors_origin("example.com")

        with pytest.raises(InvalidOriginError, match="must start with http:// or https://"):
            validate_cors_origin("ftp://example.com")

    def test_directory_traversal_attempts(self):
        """Test rejection of directory traversal in origin."""
        malicious_origins = [
            "http://example.com/../malicious",
            "https://example.com/../../etc/passwd",
            "http://localhost:3000/../admin",
        ]

        for origin in malicious_origins:
            with pytest.raises(InvalidOriginError, match="cannot contain path, query, or fragment"):
                validate_cors_origin(origin)

    def test_query_parameters_rejected(self):
        """Test rejection of origins with query parameters."""
        with pytest.raises(InvalidOriginError, match="cannot contain path, query, or fragment"):
            validate_cors_origin("http://example.com?redirect=evil.com")

    def test_fragment_rejected(self):
        """Test rejection of origins with fragments."""
        with pytest.raises(InvalidOriginError, match="cannot contain path, query, or fragment"):
            validate_cors_origin("http://example.com#fragment")

    def test_path_rejected(self):
        """Test rejection of origins with paths."""
        with pytest.raises(InvalidOriginError, match="cannot contain path, query, or fragment"):
            validate_cors_origin("http://example.com/path")

    def test_invalid_port(self):
        """Test rejection of invalid port numbers."""
        with pytest.raises(InvalidOriginError, match="port must be between 1 and 65535"):
            validate_cors_origin("http://example.com:0")

        with pytest.raises(InvalidOriginError, match="port must be between 1 and 65535"):
            validate_cors_origin("http://example.com:70000")

        with pytest.raises(InvalidOriginError, match="port must be between 1 and 65535"):
            validate_cors_origin("http://example.com:-1")

    def test_empty_hostname(self):
        """Test rejection of empty hostnames."""
        with pytest.raises(InvalidOriginError, match="hostname cannot be empty"):
            validate_cors_origin("http://")

        with pytest.raises(InvalidOriginError, match="hostname cannot be empty"):
            validate_cors_origin("https://")

    def test_invalid_hostname_characters(self):
        """Test rejection of hostnames with invalid characters."""
        with pytest.raises(InvalidOriginError, match="hostname contains invalid characters"):
            validate_cors_origin("http://exam ple.com")

        with pytest.raises(InvalidOriginError, match="hostname contains invalid characters"):
            validate_cors_origin("http://exam\nple.com")

    def test_ipv4_addresses(self):
        """Test that IPv4 addresses are accepted."""
        valid_ips = [
            "http://127.0.0.1",
            "http://192.168.1.1:8080",
            "https://10.0.0.1",
        ]

        for origin in valid_ips:
            assert validate_cors_origin(origin) is True

    def test_localhost_variations(self):
        """Test various localhost formats."""
        localhost_origins = [
            "http://localhost",
            "http://localhost:3000",
            "https://localhost:8443",
        ]

        for origin in localhost_origins:
            assert validate_cors_origin(origin) is True

    def test_wildcard_rejection(self):
        """Test that wildcard origins are rejected."""
        with pytest.raises(InvalidOriginError):
            validate_cors_origin("*")

        with pytest.raises(InvalidOriginError):
            validate_cors_origin("http://*")

    def test_empty_string(self):
        """Test rejection of empty strings."""
        with pytest.raises(InvalidOriginError):
            validate_cors_origin("")

    def test_whitespace_only(self):
        """Test rejection of whitespace-only strings."""
        with pytest.raises(InvalidOriginError):
            validate_cors_origin("   ")

    def test_null_bytes(self):
        """Test rejection of origins with null bytes."""
        with pytest.raises(InvalidOriginError):
            validate_cors_origin("http://example.com\x00")
