"""
Structured logging utilities for improved observability.

Provides JSON-formatted logging with automatic correlation ID injection
and support for structured fields.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from .correlation import get_correlation_id


class JSONFormatter(logging.Formatter):
    """
    Format log records as JSON for structured logging.

    Includes:
    - Timestamp in ISO format
    - Log level and logger name
    - Message and location (module, function, line)
    - Correlation ID (if available)
    - Exception traceback (if present)
    - Custom extra fields
    """

    # Standard LogRecord attributes to exclude from extra fields
    RESERVED_ATTRS = {
        "name", "msg", "args", "created", "filename", "funcName",
        "levelname", "levelno", "lineno", "module", "msecs", "message",
        "pathname", "process", "processName", "relativeCreated",
        "thread", "threadName", "exc_info", "exc_text", "stack_info",
        "taskName",  # Python 3.12+
    }

    def format(self, record: logging.LogRecord) -> str:
        """
        Format a LogRecord as JSON.

        Args:
            record: The log record to format

        Returns:
            JSON string representation of the log record
        """
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add correlation ID if available (from context or record)
        correlation_id = getattr(record, "correlation_id", None)
        if not correlation_id:
            try:
                correlation_id = get_correlation_id()
            except Exception:
                pass  # Ignore if correlation context not available

        if correlation_id:
            log_data["correlation_id"] = correlation_id

        # Add custom extra fields
        for key, value in record.__dict__.items():
            if key not in self.RESERVED_ATTRS and not key.startswith("_"):
                try:
                    # Attempt to serialize the value
                    json.dumps(value)
                    log_data[key] = value
                except (TypeError, ValueError):
                    # Fall back to string representation for non-serializable objects
                    log_data[key] = str(value)

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)


class StructuredLogger(logging.Logger):
    """
    Logger that supports structured logging with extra fields.

    Usage:
        logger = get_logger(__name__)
        logger.info(
            "Processing request",
            extra={
                "user_id": user.id,
                "request_path": request.path,
                "duration_ms": elapsed_time,
            }
        )
    """

    def _log_with_correlation(
        self,
        level: int,
        msg: str,
        args: tuple,
        exc_info=None,
        extra: dict[str, Any] | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
    ) -> None:
        """
        Log with automatic correlation ID injection.

        Args:
            level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            msg: Log message (may contain % formatting)
            args: Arguments for % formatting
            exc_info: Exception info tuple
            extra: Extra fields to include in log record
            stack_info: Whether to include stack trace
            stacklevel: Stack level for caller information
        """
        if extra is None:
            extra = {}

        # Inject correlation ID if not already present
        if "correlation_id" not in extra:
            try:
                correlation_id = get_correlation_id()
                if correlation_id:
                    extra["correlation_id"] = correlation_id
            except Exception:
                pass  # Ignore if correlation context not available

        # Call parent _log method
        super()._log(
            level,
            msg,
            args,
            exc_info=exc_info,
            extra=extra,
            stack_info=stack_info,
            stacklevel=stacklevel + 1,  # Adjust for wrapper
        )

    def debug(self, msg, *args, **kwargs):
        """Log debug message with structured fields."""
        if self.isEnabledFor(logging.DEBUG):
            self._log_with_correlation(logging.DEBUG, msg, args, **kwargs)

    def info(self, msg, *args, **kwargs):
        """Log info message with structured fields."""
        if self.isEnabledFor(logging.INFO):
            self._log_with_correlation(logging.INFO, msg, args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        """Log warning message with structured fields."""
        if self.isEnabledFor(logging.WARNING):
            self._log_with_correlation(logging.WARNING, msg, args, **kwargs)

    def error(self, msg, *args, **kwargs):
        """Log error message with structured fields."""
        if self.isEnabledFor(logging.ERROR):
            self._log_with_correlation(logging.ERROR, msg, args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        """Log critical message with structured fields."""
        if self.isEnabledFor(logging.CRITICAL):
            self._log_with_correlation(logging.CRITICAL, msg, args, **kwargs)


def get_logger(name: str) -> StructuredLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        StructuredLogger instance

    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("User logged in", extra={"user_id": 123})
    """
    logging.setLoggerClass(StructuredLogger)
    logger = logging.getLogger(name)

    # Only configure if not already configured
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger  # type: ignore


def configure_json_logging(
    log_level: str = "INFO",
    *,
    enable_json: bool = True,
) -> None:
    """
    Configure logging with JSON formatter for production.

    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_json: If True, use JSON formatter; if False, use standard formatter

    Example:
        >>> # In production
        >>> configure_json_logging(log_level="INFO", enable_json=True)
        >>>
        >>> # In development
        >>> configure_json_logging(log_level="DEBUG", enable_json=False)
    """
    # Set logger class
    logging.setLoggerClass(StructuredLogger)

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, log_level.upper()))

    # Set formatter
    if enable_json:
        formatter = JSONFormatter()
    else:
        # Standard format for development
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
