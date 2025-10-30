"""Base repository with common database operations."""

from __future__ import annotations

from abc import ABC
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    """Abstract base repository with common CRUD operations."""

    def __init__(self, session: AsyncSession, model: type[T]):
        """
        Initialize repository.

        Args:
            session: Database session
            model: SQLAlchemy model class
        """
        self.session = session
        self.model = model

    def _has_soft_delete(self) -> bool:
        """Check if model supports soft delete."""
        return hasattr(self.model, 'deleted_at')

    def _apply_soft_delete_filter(self, query: Any, include_deleted: bool = False) -> Any:
        """Apply soft delete filter to query if model supports it."""
        if self._has_soft_delete() and not include_deleted:
            query = query.where(self.model.deleted_at == None)  # noqa: E711
        return query

    async def get_by_id(self, id: int, include_deleted: bool = False) -> T | None:
        """
        Get entity by ID.

        Args:
            id: Entity ID
            include_deleted: Include soft-deleted records

        Returns:
            Entity or None if not found
        """
        instance = await self.session.get(self.model, id)
        if instance and self._has_soft_delete() and not include_deleted:
            if getattr(instance, 'deleted_at', None) is not None:
                return None
        return instance

    async def list_all(
        self,
        limit: int = 100,
        offset: int = 0,
        order_by: Any | None = None,
        include_deleted: bool = False
    ) -> list[T]:
        """
        List all entities with pagination.

        Args:
            limit: Maximum number of entities to return
            offset: Number of entities to skip
            order_by: Column to order by
            include_deleted: Include soft-deleted records

        Returns:
            List of entities
        """
        query = select(self.model).limit(limit).offset(offset)
        query = self._apply_soft_delete_filter(query, include_deleted)
        if order_by is not None:
            query = query.order_by(order_by)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, **kwargs: Any) -> T:
        """
        Create new entity.

        Args:
            **kwargs: Entity attributes

        Returns:
            Created entity
        """
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, id: int, **kwargs: Any) -> T | None:
        """
        Update entity.

        Args:
            id: Entity ID
            **kwargs: Attributes to update

        Returns:
            Updated entity or None if not found
        """
        instance = await self.get_by_id(id)
        if not instance:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(instance, key):
                setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def delete(self, id: int, soft: bool = True) -> bool:
        """
        Delete entity (soft delete if model supports it).

        Args:
            id: Entity ID
            soft: Use soft delete if available (default: True)

        Returns:
            True if deleted, False if not found
        """
        instance = await self.get_by_id(id, include_deleted=False)
        if not instance:
            return False

        # Use soft delete if available and requested
        if soft and self._has_soft_delete():
            setattr(instance, 'deleted_at', datetime.now(timezone.utc))
            await self.session.flush()
        else:
            await self.session.delete(instance)
            await self.session.flush()
        return True

    async def restore(self, id: int) -> bool:
        """
        Restore a soft-deleted entity.

        Args:
            id: Entity ID

        Returns:
            True if restored, False if not found or not soft-deletable
        """
        if not self._has_soft_delete():
            return False

        instance = await self.get_by_id(id, include_deleted=True)
        if not instance:
            return False

        setattr(instance, 'deleted_at', None)
        await self.session.flush()
        return True

    async def commit(self) -> None:
        """Commit the transaction."""
        await self.session.commit()

    async def rollback(self) -> None:
        """Rollback the transaction."""
        await self.session.rollback()
