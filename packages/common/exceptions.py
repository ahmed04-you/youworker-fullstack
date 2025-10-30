"""
Custom exception hierarchy for YouWorker application.

Provides structured error handling with:
- Clear exception hierarchy for different error types
- Error codes for API responses
- Additional context via details dict
"""

from __future__ import annotations


class YouWorkerException(Exception):
    """Base exception for YouWorker application."""

    def __init__(
        self,
        message: str,
        code: str | None = None,
        details: dict | None = None
    ):
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} (code: {self.code}, details: {self.details})"
        return f"{self.message} (code: {self.code})"


# Business logic errors
class ResourceNotFoundError(YouWorkerException):
    """Resource not found."""
    pass


class ValidationError(YouWorkerException):
    """Invalid input data."""
    pass


class AuthenticationError(YouWorkerException):
    """Authentication failed."""
    pass


class AuthorizationError(YouWorkerException):
    """User not authorized for this operation."""
    pass


class ConflictError(YouWorkerException):
    """Resource conflict (e.g., duplicate entry)."""
    pass


# Infrastructure errors
class DatabaseError(YouWorkerException):
    """Database operation failed."""
    pass


class ExternalServiceError(YouWorkerException):
    """External service (Ollama, Qdrant, MCP) failed."""
    pass


class ToolExecutionError(ExternalServiceError):
    """Tool execution failed."""

    def __init__(
        self,
        tool_name: str,
        message: str,
        details: dict | None = None
    ):
        self.tool_name = tool_name
        super().__init__(
            message=f"Tool '{tool_name}' execution failed: {message}",
            code="TOOL_EXECUTION_ERROR",
            details={"tool_name": tool_name, **(details or {})}
        )


class IngestionError(YouWorkerException):
    """Document ingestion failed."""
    pass


class VectorStoreError(ExternalServiceError):
    """Vector store operation failed."""
    pass


class LLMError(ExternalServiceError):
    """LLM service operation failed."""
    pass


# Configuration errors
class ConfigurationError(YouWorkerException):
    """Configuration is invalid or missing."""
    pass
