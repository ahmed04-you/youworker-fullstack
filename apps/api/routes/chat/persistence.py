"""
Database persistence utilities for chat operations.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from packages.llm import ChatMessage

logger = logging.getLogger(__name__)


async def persist_last_user_message(
    db: AsyncSession,
    session: Any,
    messages: list[ChatMessage],
) -> None:
    """
    Persist the most recent user-authored message if present.

    Args:
        db: Database session
        session: Chat session object
        messages: List of chat messages
    """
    if not messages or messages[-1].role != "user":
        return

    from packages.db.crud import add_message

    await add_message(db, session_id=session.id, role="user", content=messages[-1].content)


async def record_tool_start(
    db: AsyncSession,
    user_id: int | str,
    session_id: int | None,
    tool_name: str | None,
    args: Any,
    start_ts: datetime,
) -> int | None:
    """
    Record tool start and return the run identifier.

    Args:
        db: Database session
        user_id: User ID
        session_id: Chat session ID
        tool_name: Name of the tool
        args: Tool arguments
        start_ts: Start timestamp

    Returns:
        Tool run ID or None if tool_name is None
    """
    if tool_name is None:
        return None

    from packages.db.crud import start_tool_run

    run = await start_tool_run(
        db,
        user_id=user_id,
        session_id=session_id,
        tool_name=tool_name,
        args=args,
        start_ts=start_ts,
    )
    return run.id if run is not None else None


async def record_tool_end(
    db: AsyncSession,
    run_id: int | None,
    status: str | None,
    end_ts: datetime,
    latency_ms: int | None,
    result_preview: str | None,
    tool_name: str | None,
) -> None:
    """
    Finalize tool run bookkeeping if a start was recorded.

    Args:
        db: Database session
        run_id: Tool run ID from record_tool_start
        status: Tool execution status
        end_ts: End timestamp
        latency_ms: Execution latency in milliseconds
        result_preview: Preview of tool result
        tool_name: Name of the tool
    """
    if run_id is None:
        return

    from packages.db.crud import finish_tool_run

    await finish_tool_run(
        db,
        run_id=run_id,
        status="success" if status == "end" else (status or "unknown"),
        end_ts=end_ts,
        latency_ms=latency_ms,
        result_preview=result_preview,
        tool_name=tool_name,
    )


async def persist_final_assistant_message(
    db: AsyncSession,
    session_id: int,
    final_text: str,
) -> None:
    """
    Store the assistant's final response.

    Args:
        db: Database session
        session_id: Chat session ID
        final_text: Final assistant message
    """
    from packages.db.crud import add_message

    await add_message(db, session_id=session_id, role="assistant", content=final_text)


async def get_or_create_chat_session(
    db: AsyncSession,
    user_id: int,
    external_id: str | None,
    model: str,
    enable_tools: bool,
) -> Any:
    """
    Get existing or create new chat session.

    Args:
        db: Database session
        user_id: User ID
        external_id: External session ID
        model: Model name
        enable_tools: Whether tools are enabled

    Returns:
        Chat session object
    """
    from packages.db.crud import get_or_create_session

    return await get_or_create_session(
        db,
        user_id=user_id,
        external_id=external_id,
        model=model,
        enable_tools=enable_tools,
    )
