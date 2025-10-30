"""Audit logging utilities for tracking sensitive operations."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.correlation import get_correlation_id

logger = logging.getLogger(__name__)


async def create_audit_log(
    session: AsyncSession,
    *,
    action: str,
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    changes: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> None:
    """
    Create an audit log entry.

    Args:
        session: Database session
        action: Action identifier (e.g., 'user.login', 'document.delete')
        user_id: ID of the user who performed the action
        resource_type: Type of resource affected (e.g., 'user', 'document')
        resource_id: ID of the affected resource
        changes: Dictionary of changes (before/after values or action details)
        ip_address: Client IP address
        user_agent: Client user agent string
        success: Whether the action succeeded
        error_message: Error message if action failed

    Example:
        await create_audit_log(
            db,
            action="user.api_key.regenerate",
            user_id=user.id,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=request.client.host,
            success=True,
        )
    """
    from packages.db.models import AuditLog

    correlation_id = get_correlation_id() or None

    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent,
        correlation_id=correlation_id,
        success=success,
        error_message=error_message,
        timestamp=datetime.now(timezone.utc),
    )

    session.add(audit_entry)
    # Note: Caller is responsible for committing the session
    logger.info(
        "Audit log created: action=%s, user_id=%s, resource=%s/%s, success=%s",
        action,
        user_id,
        resource_type,
        resource_id,
        success,
    )


async def log_user_action(
    session: AsyncSession,
    action: str,
    user_id: int,
    *,
    resource_type: str | None = None,
    resource_id: str | None = None,
    changes: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Convenience function to log a successful user action.

    Wrapper around create_audit_log with success=True.
    """
    await create_audit_log(
        session,
        action=action,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent,
        success=True,
    )


async def log_security_event(
    session: AsyncSession,
    action: str,
    *,
    user_id: int | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    success: bool = True,
) -> None:
    """
    Log a security-related event.

    Use this for authentication failures, authorization violations,
    suspicious activity, etc.

    Args:
        session: Database session
        action: Security event type (e.g., 'auth.login.failed', 'auth.unauthorized')
        user_id: User ID if applicable
        details: Additional event details
        ip_address: Client IP address
        user_agent: Client user agent
        success: Whether the action was allowed (False for violations)
    """
    await create_audit_log(
        session,
        action=action,
        user_id=user_id,
        resource_type="security",
        changes=details,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
    )


# Common audit action types
class AuditAction:
    """Common audit action identifiers."""

    # User actions
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_REGISTER = "user.register"
    USER_API_KEY_REGENERATE = "user.api_key.regenerate"
    USER_UPDATE = "user.update"
    USER_DELETE = "user.delete"

    # Document actions
    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_DELETE = "document.delete"
    DOCUMENT_ACCESS = "document.access"
    DOCUMENT_SHARE = "document.share"

    # Admin actions
    ADMIN_USER_CREATE = "admin.user.create"
    ADMIN_USER_DELETE = "admin.user.delete"
    ADMIN_SETTINGS_UPDATE = "admin.settings.update"

    # Security events
    AUTH_LOGIN_FAILED = "auth.login.failed"
    AUTH_UNAUTHORIZED = "auth.unauthorized"
    AUTH_TOKEN_EXPIRED = "auth.token.expired"
    AUTH_SUSPICIOUS_ACTIVITY = "auth.suspicious_activity"
