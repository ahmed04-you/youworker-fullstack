"""
Common utilities, settings, and accelerator management for the ingestion pipeline.
"""

from .logger import get_logger
from .settings import Settings, get_settings
from .accelerator import AcceleratorChoice, coerce_preference, resolve_accelerator
from .correlation import get_correlation_id, set_correlation_id, clear_correlation_id, correlation_id_var
from .health import (
    HealthStatus,
    HealthCheck,
    check_postgres_health,
    check_qdrant_health,
    check_ollama_health,
    check_mcp_servers_health,
    get_aggregate_health,
)
from .audit import (
    create_audit_log,
    log_user_action,
    log_security_event,
    AuditAction,
)
from .exceptions import (
    YouWorkerException,
    ResourceNotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    DatabaseError,
    ExternalServiceError,
    ToolExecutionError,
    IngestionError,
    VectorStoreError,
    LLMError,
    ConfigurationError,
)

__all__ = [
    "get_logger",
    "Settings",
    "get_settings",
    "AcceleratorChoice",
    "coerce_preference",
    "resolve_accelerator",
    "get_correlation_id",
    "set_correlation_id",
    "clear_correlation_id",
    "correlation_id_var",
    # Health checks
    "HealthStatus",
    "HealthCheck",
    "check_postgres_health",
    "check_qdrant_health",
    "check_ollama_health",
    "check_mcp_servers_health",
    "get_aggregate_health",
    # Audit logging
    "create_audit_log",
    "log_user_action",
    "log_security_event",
    "AuditAction",
    # Exceptions
    "YouWorkerException",
    "ResourceNotFoundError",
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "ConflictError",
    "DatabaseError",
    "ExternalServiceError",
    "ToolExecutionError",
    "IngestionError",
    "VectorStoreError",
    "LLMError",
    "ConfigurationError",
]
