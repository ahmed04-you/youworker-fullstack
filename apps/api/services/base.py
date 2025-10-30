"""
Base service class for business logic layer.

This module provides a base class that all service classes should inherit from.
Services encapsulate business logic and are independent of HTTP/API concerns.
"""

from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings


class BaseService:
    """
    Base class for all service layer classes.

    Services encapsulate business logic and:
    - Are independent of HTTP/FastAPI infrastructure
    - Can be unit tested in isolation
    - Declare their dependencies explicitly
    - Are reusable across different interfaces (REST, WebSocket, CLI, etc.)

    Attributes:
        db: Database session for persistence operations
        settings: Application settings
    """

    def __init__(self, db_session: AsyncSession, settings: Any = settings):
        """
        Initialize base service.

        Args:
            db_session: SQLAlchemy async session for database operations
            settings: Application settings (defaults to global settings)
        """
        self.db = db_session
        self.settings = settings
