"""
Input validation utilities beyond Pydantic models.
"""

import re
from pathlib import Path

from apps.api.auth.security import sanitize_input
from apps.api.utils.error_handling import ValidationError


SUPPORTED_LANGUAGES = {"it", "en"}
SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")


def validate_language(language: str | None, default: str = "en") -> str:
    """
    Validate and normalize language code.

    Args:
        language: Language code to validate
        default: Default language if validation fails

    Returns:
        Validated language code

    Raises:
        ValidationError: If language is invalid and no default
    """
    if not language:
        return default

    normalized = language.strip().lower()

    if normalized not in SUPPORTED_LANGUAGES:
        if default in SUPPORTED_LANGUAGES:
            return default
        raise ValidationError("language", f"Unsupported language: {normalized}")

    return normalized


def validate_session_id(session_id: str | None) -> str | None:
    """
    Validate session ID format.

    Args:
        session_id: Session ID to validate

    Returns:
        Validated session ID or None

    Raises:
        ValidationError: If session ID format is invalid
    """
    if not session_id:
        return None

    if not SESSION_ID_PATTERN.match(session_id):
        raise ValidationError(
            "session_id",
            "Session ID must contain only alphanumeric characters, hyphens, and underscores (max 128 chars)",
        )

    return session_id


def sanitize_user_input(
    text: str,
    field_name: str = "input",
    max_length: int | None = None,
    allow_empty: bool = False,
) -> str:
    """
    Sanitize user input text.

    Args:
        text: Text to sanitize
        field_name: Name of field for error messages
        max_length: Maximum allowed length
        allow_empty: Whether to allow empty strings

    Returns:
        Sanitized text

    Raises:
        ValidationError: If validation fails
    """
    if not text and not allow_empty:
        raise ValidationError(field_name, "Cannot be empty")

    sanitized = sanitize_input(text, max_length=max_length)

    if not sanitized and not allow_empty:
        raise ValidationError(field_name, "Sanitization produced empty value")

    return sanitized


def validate_file_path(
    path: str,
    allowed_roots: list[str | Path],
    must_exist: bool = False,
) -> Path:
    """
    Validate file path to prevent path traversal attacks.

    Args:
        path: Path to validate
        allowed_roots: List of allowed root directories
        must_exist: Whether the path must exist

    Returns:
        Validated Path object

    Raises:
        ValidationError: If path is invalid or not in allowed roots
    """
    try:
        resolved_path = Path(path).resolve()
    except (ValueError, OSError) as e:
        raise ValidationError("path", f"Invalid path: {e}")

    # Check if path is within allowed directories
    is_allowed = False
    for root in allowed_roots:
        root_path = Path(root).resolve()
        if resolved_path == root_path or root_path in resolved_path.parents:
            is_allowed = True
            break

    if not is_allowed:
        raise ValidationError(
            "path",
            f"Path must be within allowed directories: {', '.join(str(r) for r in allowed_roots)}",
        )

    if must_exist and not resolved_path.exists():
        raise ValidationError("path", f"Path does not exist: {path}")

    return resolved_path


def validate_tags(tags: list[str] | None, max_tags: int = 10, max_tag_length: int = 128) -> list[str]:
    """
    Validate and sanitize a list of tags.

    Args:
        tags: List of tags to validate
        max_tags: Maximum number of tags allowed
        max_tag_length: Maximum length of each tag

    Returns:
        List of validated tags

    Raises:
        ValidationError: If validation fails
    """
    if not tags:
        return []

    if len(tags) > max_tags:
        raise ValidationError("tags", f"Maximum {max_tags} tags allowed")

    sanitized_tags: list[str] = []
    for tag in tags:
        cleaned = sanitize_input(tag, max_length=max_tag_length)
        if cleaned:
            sanitized_tags.append(cleaned)

    return sanitized_tags


def validate_pagination(
    page: int | None = None,
    page_size: int | None = None,
    max_page_size: int = 100,
) -> tuple[int, int]:
    """
    Validate pagination parameters.

    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page
        max_page_size: Maximum allowed page size

    Returns:
        Tuple of (page, page_size)

    Raises:
        ValidationError: If validation fails
    """
    validated_page = page or 1
    validated_page_size = page_size or 20

    if validated_page < 1:
        raise ValidationError("page", "Page must be >= 1")

    if validated_page_size < 1:
        raise ValidationError("page_size", "Page size must be >= 1")

    if validated_page_size > max_page_size:
        raise ValidationError("page_size", f"Page size must be <= {max_page_size}")

    return validated_page, validated_page_size
