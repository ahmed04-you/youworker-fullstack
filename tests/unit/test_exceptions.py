"""
Unit tests for custom exception hierarchy (P1-2).

Tests the standardized error handling with custom exceptions
and proper error response formatting.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from packages.common.exceptions import (
    YouWorkerError,
    ValidationError,
    ResourceNotFoundError,
    AuthenticationError,
    AuthorizationError,
    ConfigurationError,
    DatabaseError,
    ExternalServiceError,
    RateLimitError,
)


class TestExceptionHierarchy:
    """Test custom exception hierarchy."""

    def test_base_exception_creation(self):
        """Test base YouWorkerError exception."""
        error = YouWorkerError("Base error message")

        assert str(error) == "Base error message"
        assert error.message == "Base error message"
        assert error.details is None

    def test_exception_with_details(self):
        """Test exception with additional details."""
        error = YouWorkerError(
            "Error with details",
            details={"field": "username", "reason": "too short"}
        )

        assert error.message == "Error with details"
        assert error.details == {"field": "username", "reason": "too short"}

    def test_validation_error(self):
        """Test ValidationError exception."""
        error = ValidationError(
            "Invalid input",
            details={"field": "email", "value": "not-an-email"}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Invalid input"
        assert error.details["field"] == "email"

    def test_resource_not_found_error(self):
        """Test ResourceNotFoundError exception."""
        error = ResourceNotFoundError(
            "Document not found",
            details={"document_id": 123}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Document not found"
        assert error.details["document_id"] == 123

    def test_authentication_error(self):
        """Test AuthenticationError exception."""
        error = AuthenticationError("Invalid credentials")

        assert isinstance(error, YouWorkerError)
        assert error.message == "Invalid credentials"

    def test_authorization_error(self):
        """Test AuthorizationError exception."""
        error = AuthorizationError(
            "Access denied",
            details={"required_permission": "admin"}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Access denied"

    def test_configuration_error(self):
        """Test ConfigurationError exception."""
        error = ConfigurationError(
            "Invalid configuration",
            details={"setting": "DATABASE_URL", "reason": "missing"}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Invalid configuration"

    def test_database_error(self):
        """Test DatabaseError exception."""
        error = DatabaseError(
            "Connection failed",
            details={"host": "localhost", "port": 5432}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Connection failed"

    def test_external_service_error(self):
        """Test ExternalServiceError exception."""
        error = ExternalServiceError(
            "Ollama unavailable",
            details={"service": "ollama", "status_code": 503}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Ollama unavailable"

    def test_rate_limit_error(self):
        """Test RateLimitError exception."""
        error = RateLimitError(
            "Too many requests",
            details={"retry_after": 60}
        )

        assert isinstance(error, YouWorkerError)
        assert error.message == "Too many requests"

    def test_exception_inheritance_chain(self):
        """Test that all custom exceptions inherit from base."""
        exceptions = [
            ValidationError("test"),
            ResourceNotFoundError("test"),
            AuthenticationError("test"),
            AuthorizationError("test"),
            ConfigurationError("test"),
            DatabaseError("test"),
            ExternalServiceError("test"),
            RateLimitError("test"),
        ]

        for exc in exceptions:
            assert isinstance(exc, YouWorkerError)
            assert isinstance(exc, Exception)


class TestExceptionHandlers:
    """Test FastAPI exception handlers for standardized error responses."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app with exception handlers."""
        from apps.api.main import create_app

        app = create_app()
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_validation_error_response_format(self, app):
        """Test ValidationError returns proper error response."""
        @app.get("/test-validation-error")
        async def test_route():
            raise ValidationError(
                "Invalid field",
                details={"field": "email"}
            )

        client = TestClient(app)
        response = client.get("/test-validation-error")

        assert response.status_code == 400
        data = response.json()

        # Check standardized error format
        assert "error" in data
        assert data["error"]["message"] == "Invalid field"
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert data["error"]["details"]["field"] == "email"

    def test_resource_not_found_response_format(self, app):
        """Test ResourceNotFoundError returns 404."""
        @app.get("/test-not-found")
        async def test_route():
            raise ResourceNotFoundError("Document not found")

        client = TestClient(app)
        response = client.get("/test-not-found")

        assert response.status_code == 404
        data = response.json()

        assert data["error"]["message"] == "Document not found"
        assert data["error"]["code"] == "RESOURCE_NOT_FOUND"

    def test_authentication_error_response_format(self, app):
        """Test AuthenticationError returns 401."""
        @app.get("/test-auth-error")
        async def test_route():
            raise AuthenticationError("Invalid token")

        client = TestClient(app)
        response = client.get("/test-auth-error")

        assert response.status_code == 401
        data = response.json()

        assert data["error"]["message"] == "Invalid token"
        assert data["error"]["code"] == "AUTHENTICATION_ERROR"

    def test_authorization_error_response_format(self, app):
        """Test AuthorizationError returns 403."""
        @app.get("/test-authz-error")
        async def test_route():
            raise AuthorizationError("Access denied")

        client = TestClient(app)
        response = client.get("/test-authz-error")

        assert response.status_code == 403
        data = response.json()

        assert data["error"]["message"] == "Access denied"
        assert data["error"]["code"] == "AUTHORIZATION_ERROR"

    def test_rate_limit_error_response_format(self, app):
        """Test RateLimitError returns 429."""
        @app.get("/test-rate-limit")
        async def test_route():
            raise RateLimitError(
                "Too many requests",
                details={"retry_after": 60}
            )

        client = TestClient(app)
        response = client.get("/test-rate-limit")

        assert response.status_code == 429
        data = response.json()

        assert data["error"]["message"] == "Too many requests"
        assert data["error"]["code"] == "RATE_LIMIT_ERROR"
        assert data["error"]["details"]["retry_after"] == 60

    def test_configuration_error_response_format(self, app):
        """Test ConfigurationError returns 500."""
        @app.get("/test-config-error")
        async def test_route():
            raise ConfigurationError("Invalid config")

        client = TestClient(app)
        response = client.get("/test-config-error")

        assert response.status_code == 500
        data = response.json()

        assert data["error"]["message"] == "Invalid config"
        assert data["error"]["code"] == "CONFIGURATION_ERROR"

    def test_database_error_response_format(self, app):
        """Test DatabaseError returns 500."""
        @app.get("/test-db-error")
        async def test_route():
            raise DatabaseError("Connection failed")

        client = TestClient(app)
        response = client.get("/test-db-error")

        assert response.status_code == 500
        data = response.json()

        assert data["error"]["message"] == "Connection failed"
        assert data["error"]["code"] == "DATABASE_ERROR"

    def test_external_service_error_response_format(self, app):
        """Test ExternalServiceError returns 503."""
        @app.get("/test-service-error")
        async def test_route():
            raise ExternalServiceError(
                "Service unavailable",
                details={"service": "ollama"}
            )

        client = TestClient(app)
        response = client.get("/test-service-error")

        assert response.status_code == 503
        data = response.json()

        assert data["error"]["message"] == "Service unavailable"
        assert data["error"]["code"] == "EXTERNAL_SERVICE_ERROR"

    def test_generic_youworker_error_response(self, app):
        """Test generic YouWorkerError returns 500."""
        @app.get("/test-generic-error")
        async def test_route():
            raise YouWorkerError("Something went wrong")

        client = TestClient(app)
        response = client.get("/test-generic-error")

        assert response.status_code == 500
        data = response.json()

        assert data["error"]["message"] == "Something went wrong"
        assert data["error"]["code"] == "YOUWORKER_ERROR"

    def test_error_response_includes_all_fields(self, app):
        """Test error response includes message, code, and details."""
        @app.get("/test-full-error")
        async def test_route():
            raise ValidationError(
                "Multiple validation errors",
                details={
                    "fields": ["email", "password"],
                    "count": 2
                }
            )

        client = TestClient(app)
        response = client.get("/test-full-error")

        data = response.json()

        # Verify all required fields are present
        assert "error" in data
        assert "message" in data["error"]
        assert "code" in data["error"]
        assert "details" in data["error"]
        assert data["error"]["details"]["count"] == 2

    def test_error_without_details(self, app):
        """Test error response when details are not provided."""
        @app.get("/test-no-details")
        async def test_route():
            raise ValidationError("Simple error")

        client = TestClient(app)
        response = client.get("/test-no-details")

        data = response.json()

        assert "error" in data
        assert data["error"]["message"] == "Simple error"
        # Details should be null or empty object
        assert data["error"]["details"] is None or data["error"]["details"] == {}
