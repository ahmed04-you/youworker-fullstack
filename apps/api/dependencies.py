"""Centralized dependency injection for FastAPI.

This module provides all FastAPI dependencies for:
- Database sessions and repositories
- Business logic services
- Infrastructure components
- Authentication
"""

from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db import get_async_session
from packages.db.repositories import (
    ChatRepository,
    DocumentRepository,
    GroupRepository,
    ToolRepository,
    UserRepository,
    IngestionRepository,
)
from apps.api.services import (
    AccountService,
    GroupService,
    SessionService,
    DocumentService,
    AnalyticsService,
)


# ==================== DATABASE SESSION ====================


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session.

    Yields:
        Database session
    """
    async with get_async_session() as session:
        yield session


# ==================== REPOSITORIES ====================


def get_user_repository(
    session: AsyncSession = Depends(get_db_session)
) -> UserRepository:
    """
    Get user repository.

    Args:
        session: Database session

    Returns:
        User repository
    """
    return UserRepository(session)


def get_group_repository(
    session: AsyncSession = Depends(get_db_session)
) -> GroupRepository:
    """
    Get group repository.

    Args:
        session: Database session

    Returns:
        Group repository
    """
    return GroupRepository(session)


def get_chat_repository(
    session: AsyncSession = Depends(get_db_session)
) -> ChatRepository:
    """
    Get chat repository.

    Args:
        session: Database session

    Returns:
        Chat repository
    """
    return ChatRepository(session)


def get_document_repository(
    session: AsyncSession = Depends(get_db_session)
) -> DocumentRepository:
    """
    Get document repository.

    Args:
        session: Database session

    Returns:
        Document repository
    """
    return DocumentRepository(session)


def get_tool_repository(
    session: AsyncSession = Depends(get_db_session)
) -> ToolRepository:
    """
    Get tool repository.

    Args:
        session: Database session

    Returns:
        Tool repository
    """
    return ToolRepository(session)


def get_ingestion_repository(
    session: AsyncSession = Depends(get_db_session)
) -> IngestionRepository:
    """
    Get ingestion repository.

    Args:
        session: Database session

    Returns:
        Ingestion repository
    """
    return IngestionRepository(session)


# ==================== SERVICES ====================


def get_group_service(
    group_repo: GroupRepository = Depends(get_group_repository),
    user_repo: UserRepository = Depends(get_user_repository)
) -> GroupService:
    """
    Get group service.

    Args:
        group_repo: Group repository
        user_repo: User repository

    Returns:
        Group service
    """
    return GroupService(group_repo, user_repo)


def get_account_service(
    user_repo: UserRepository = Depends(get_user_repository)
) -> AccountService:
    """
    Get account service.

    Args:
        user_repo: User repository

    Returns:
        Account service
    """
    return AccountService(user_repo)


def get_session_service(
    chat_repo: ChatRepository = Depends(get_chat_repository),
    tool_repo: ToolRepository = Depends(get_tool_repository)
) -> SessionService:
    """
    Get session service.

    Args:
        chat_repo: Chat repository
        tool_repo: Tool repository

    Returns:
        Session service
    """
    return SessionService(chat_repo, tool_repo)


def get_document_service(
    document_repo: DocumentRepository = Depends(get_document_repository)
) -> DocumentService:
    """
    Get document service.

    Args:
        document_repo: Document repository

    Returns:
        Document service
    """
    return DocumentService(document_repo)


def get_analytics_service(
    tool_repo: ToolRepository = Depends(get_tool_repository),
    ingestion_repo: IngestionRepository = Depends(get_ingestion_repository)
) -> AnalyticsService:
    """
    Get analytics service.

    Args:
        tool_repo: Tool repository
        ingestion_repo: Ingestion repository

    Returns:
        Analytics service
    """
    return AnalyticsService(tool_repo, ingestion_repo)
