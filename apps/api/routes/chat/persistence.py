"""
Persistence functions for unified chat API.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from packages.db.crud import (
    get_or_create_session,
    add_message,
    start_tool_run,
    finish_tool_run,
)
from packages.db.models import ChatSession


async def persist_last_user_message(
    db,
    chat_session: ChatSession,
    conversation: list,
):
    """Persist the last user message to the database."""
    if conversation and conversation[-1].role == "user":
        await add_message(
            session=db,
            session_id=chat_session.id,
            role="user",
            content=conversation[-1].content,
        )


async def record_tool_start(
    db,
    user_id: int,
    session_id: Optional[int],
    message_id: Optional[int],
    tool_name: str,
    args: Dict[str, Any],
    start_ts: datetime,
):
    """Record the start of a tool execution linked to the message being generated."""
    return await start_tool_run(
        session=db,
        user_id=user_id,
        session_id=session_id,
        message_id=message_id,
        tool_name=tool_name,
        args=args,
        start_ts=start_ts,
    )


async def record_tool_end(
    db,
    run_id: int,
    status: str,
    end_ts: datetime,
    latency_ms: Optional[int] = None,
    result_preview: Optional[str] = None,
    tool_name: Optional[str] = None,
):
    """Record the end of a tool execution."""
    await finish_tool_run(
        session=db,
        run_id=run_id,
        status=status,
        end_ts=end_ts,
        latency_ms=latency_ms,
        result_preview=result_preview,
        error_message=None if status == "success" else result_preview,
        tool_name=tool_name,
    )


async def persist_final_assistant_message(
    db,
    chat_session_id: int,
    content: str,
):
    """Persist the final assistant message to the database."""
    await add_message(
        session=db,
        session_id=chat_session_id,
        role="assistant",
        content=content,
    )


async def get_or_create_chat_session(
    db,
    user_id: int,
    external_id: str,
    model: str,
    enable_tools: bool,
) -> ChatSession:
    """Get an existing chat session or create a new one."""
    return await get_or_create_session(
        session=db,
        user_id=user_id,
        external_id=external_id,
        model=model,
        enable_tools=enable_tools,
    )


async def get_chat_session_by_external_id(
    db,
    external_id: str,
) -> Optional[ChatSession]:
    """Get a chat session by external ID."""
    from sqlalchemy import select

    q = select(ChatSession).where(ChatSession.external_id == external_id)
    result = await db.execute(q)
    return result.scalar_one_or_none()
