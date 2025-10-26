"""
Helper functions for unified chat API.
"""

from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional

import logging
from packages.db import get_async_session
from packages.llm import ChatMessage as LLMChatMessage

from .persistence import record_tool_start, record_tool_end


async def prepare_chat_messages(history: List[dict]) -> List[LLMChatMessage]:
    """Prepare chat messages for agent loop."""
    messages = []
    for msg in history:
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            messages.append(LLMChatMessage(role=msg["role"], content=msg["content"]))
    return messages


def resolve_assistant_language(language: str) -> str:
    """Resolve assistant language from request."""
    # Default to English if not specified
    return language or "en"


async def handle_tool_event(
    db_session,
    user_id: int,
    session_id: int,
    event_data: Dict[str, Any],
    last_tool_run_id: Optional[int],
) -> tuple[Optional[int], Dict[str, Any]]:
    """
    Handle a tool event (start or end), record to DB, and return updated run_id and event.

    Appends tool event to data and handles persistence.
    """
    logger = logging.getLogger(__name__)
    event_data = event_data.copy()  # Avoid mutating original
    ts_raw = event_data.get("ts")
    try:
        parsed_ts = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
    except (ValueError, TypeError) as exc:
        logger.warning("Invalid timestamp format: %s", exc)
        parsed_ts = datetime.utcnow()

    status = event_data.get("status")
    tool_name = event_data.get("tool")
    args = event_data.get("args", {})
    if status == "start":
        if not isinstance(tool_name, str) or not tool_name:
            logger.warning("Invalid tool_name for start event: %s", tool_name)
            return None, event_data
        if not isinstance(args, dict):
            logger.warning("Invalid args for start event: %s", args)
            args = {}
        tool_run = await record_tool_start(
            db_session,
            user_id=user_id,
            session_id=session_id,
            tool_name=tool_name,
            args=args,
            start_ts=parsed_ts,
        )
        new_run_id = tool_run.id if tool_run else None
        return new_run_id, event_data
    else:  # end or error
        if last_tool_run_id is not None:
            if not isinstance(status, str) or not status:
                logger.warning("Invalid status for end event: %s", status)
                status = "error"
            latency_val = event_data.get("latency_ms")
            latency_ms = None
            if isinstance(latency_val, (int, float)):
                latency_ms = int(latency_val)

            tool_name_end = event_data.get("tool")
            await record_tool_end(
                db_session,
                run_id=last_tool_run_id,
                status=status,
                end_ts=parsed_ts,
                latency_ms=latency_ms,
                result_preview=(event_data.get("result_preview") or None),
                tool_name=tool_name_end,
            )
        return None, event_data


async def process_tracked_agent_events(
    agent_loop,
    conversation: List[LLMChatMessage],
    enable_tools: bool,
    max_iterations: int,
    language: str,
    model: str,
    user_id: int,
    session_id: int,
    stream: bool = True,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Process agent loop events with tool tracking, handling persistence.

    Yields events for streaming; for non-streaming, collects results.
    """
    tool_events: List[Dict[str, Any]] = []
    logs: List[Dict[str, str]] = []
    last_tool_run_id: Optional[int] = None
    collected_content = ""

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=enable_tools,
        max_iterations=max_iterations,
        language=language,
        model=model,
    ):
        event_type = event.get("event")
        data = event.get("data", {}) or {}

        if event_type == "tool" and enable_tools:
            async with get_async_session() as db:
                last_tool_run_id, data = await handle_tool_event(
                    db, user_id, session_id, data, last_tool_run_id
                )
            tool_events.append(data)
            if stream:
                yield {"event": event_type, "data": data}
            continue

        elif event_type == "token":
            if stream:
                yield event
            collected_content += data.get("text", "")

        elif event_type == "log":
            logs.append(data)
            if stream:
                yield event

        elif event_type == "done":
            if stream:
                yield event
            break

    if not stream:
        # For non-streaming, yield collected
        yield {
            "event": "done",
            "data": {
                "final_text": collected_content,
                "tool_events": tool_events,
                "logs": logs,
            },
        }
