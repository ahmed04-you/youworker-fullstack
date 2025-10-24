"""
Shared utilities for the API.
"""

from .error_handling import (
    APIError,
    ServiceUnavailableError,
    ValidationError,
    handle_exceptions,
    format_error_response,
)
from .response_formatting import (
    success_response,
    error_response,
    paginated_response,
    sse_format,
)
from .validation import (
    validate_language,
    validate_session_id,
    sanitize_user_input,
    validate_file_path,
)
from .retry import retry_async, exponential_backoff

__all__ = [
    "APIError",
    "ServiceUnavailableError",
    "ValidationError",
    "handle_exceptions",
    "format_error_response",
    "success_response",
    "error_response",
    "paginated_response",
    "sse_format",
    "validate_language",
    "validate_session_id",
    "sanitize_user_input",
    "validate_file_path",
    "retry_async",
    "exponential_backoff",
]
