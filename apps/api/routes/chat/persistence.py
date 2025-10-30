"""
Persistence functions for unified chat API.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db.models import ChatSession, ToolRun
from packages.db.repositories import ChatRepository, ToolRepository


async def persist_last_user_message(
    db: AsyncSession,
    chat_session: ChatSession,
    conversation: list,
) -> None:
    """Persist the last user message to the database."""
    if conversation and conversation[-1].role == "user":
        chat_repo = ChatRepository(db)
        await chat_repo.add_message(
            session_id=chat_session.id,
            role="user",
            content=conversation[-1].content,
        )


async def record_tool_start(
    db: AsyncSession,
    user_id: int,
    session_id: int | None,
    message_id: int | None,
    tool_name: str,
    args: dict | None,
    start_ts: datetime,
) -> ToolRun:
    """Record the start of a tool execution linked to the message being generated."""
    tool_repo = ToolRepository(db)
    return await tool_repo.start_tool_run(
        user_id=user_id,
        session_id=session_id,
        message_id=message_id,
        tool_name=tool_name,
        args=args,
        start_ts=start_ts,
    )


async def record_tool_end(
    db: AsyncSession,
    run_id: int,
    status: str,
    end_ts: datetime,
    latency_ms: int | None = None,
    result_preview: str | None = None,
    tool_name: str | None = None,
) -> None:
    """Record the end of a tool execution."""
    tool_repo = ToolRepository(db)
    await tool_repo.finish_tool_run(
        run_id=run_id,
        status=status,
        end_ts=end_ts,
        latency_ms=latency_ms,
        result_preview=result_preview,
        error_message=None if status == "success" else result_preview,
        tool_name=tool_name,
    )


async def persist_final_assistant_message(
    db: AsyncSession,
    chat_session_id: int,
    content: str,
) -> None:
    """Persist the final assistant message to the database."""
    chat_repo = ChatRepository(db)
    await chat_repo.add_message(
        session_id=chat_session_id,
        role="assistant",
        content=content,
    )


async def get_or_create_chat_session(
    db: AsyncSession,
    user_id: int,
    external_id: str,
    model: str,
    enable_tools: bool,
) -> ChatSession:
    """Get an existing chat session or create a new one."""
    chat_repo = ChatRepository(db)
    return await chat_repo.get_or_create_session(
        user_id=user_id,
        external_id=external_id,
        model=model,
        enable_tools=enable_tools,
    )


async def get_chat_session_by_external_id(
    db: AsyncSession,
    external_id: str,
) -> ChatSession | None:
    """Get a chat session by external ID."""
    q = select(ChatSession).where(ChatSession.external_id == external_id)
    result = await db.execute(q)
    return result.scalar_one_or_none()
