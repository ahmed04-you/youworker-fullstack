"""
Helper functions for unified chat API.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from apps.api.config import settings as api_settings
from packages.db import get_async_session
from packages.llm import ChatMessage as LLMChatMessage

from .persistence import record_tool_end, record_tool_start


class ToolEventRecorder:
    """
    Persist tool lifecycle events while tracking the associated ToolRun row.

    Call sites can reuse a single recorder during a request to avoid juggling
    run identifiers across asynchronous boundaries.
    """

    def __init__(
        self,
        user_id: int,
        session_id: Optional[int],
        *,
        db_factory=get_async_session,
    ) -> None:
        self._user_id = user_id
        self._session_id = session_id
        self._db_factory = db_factory
        self._last_run_id: Optional[int] = None
        self._logger = logging.getLogger(f"{__name__}.ToolEventRecorder")

    async def record(self, event_data: Dict[str, Any] | None) -> Dict[str, Any]:
        """
        Persist the supplied tool event and return a sanitized copy.

        `event_data` must contain a `tool` name and a `status` field. Any
        persistence errors are logged but do not surface to the caller so
        streaming responses remain resilient.
        """
        data = dict(event_data or {})
        status_raw = str(data.get("status") or "").lower()

        ts_raw = data.get("ts")
        try:
            timestamp = datetime.fromisoformat(ts_raw) if ts_raw else datetime.now(timezone.utc)
        except (TypeError, ValueError):
            self._logger.warning("Invalid tool timestamp '%s'; using current time", ts_raw)
            timestamp = datetime.now(timezone.utc)

        tool_name = data.get("tool")
        if not isinstance(tool_name, str) or not tool_name:
            self._logger.warning("Ignoring tool event without valid tool name: %s", data)
            return data

        if status_raw in {"", "start"}:
            args = data.get("args")
            if not isinstance(args, dict):
                if args is not None:
                    self._logger.warning("Unexpected args payload for tool start: %s", type(args))
                args = {}

            try:
                async with self._db_factory() as db:
                    run = await record_tool_start(
                        db,
                        user_id=self._user_id,
                        session_id=self._session_id,
                        tool_name=tool_name,
                        args=args,
                        start_ts=timestamp,
                    )
            except Exception as exc:  # pragma: no cover - defensive logging
                self._logger.error(
                    "Failed to persist tool start for %s: %s", tool_name, exc, exc_info=True
                )
                self._last_run_id = None
                return data

            run_id = getattr(run, "id", None)
            if isinstance(run_id, int):
                self._last_run_id = run_id
                data["run_id"] = run_id
            else:
                self._last_run_id = None
            data["args"] = args
            return data

        # Handle end / error style events
        run_id = self._last_run_id or data.get("run_id")
        run_id = run_id if isinstance(run_id, int) else None
        if run_id is None:
            self._logger.warning(
                "Received %s event for %s without matching start; skipping persistence",
                status_raw or "end",
                tool_name,
            )
            return data

        latency_val = data.get("latency_ms")
        latency_ms = int(latency_val) if isinstance(latency_val, (int, float)) else None
        db_status = "success" if status_raw in {"end", "success", ""} else status_raw

        try:
            async with self._db_factory() as db:
                await record_tool_end(
                    db,
                    run_id=run_id,
                    status=db_status,
                    end_ts=timestamp,
                    latency_ms=latency_ms,
                    result_preview=(data.get("result_preview") or None),
                    tool_name=tool_name,
                )
        except Exception as exc:  # pragma: no cover - defensive logging
            self._logger.error(
                "Failed to finalize tool run %s for %s: %s", run_id, tool_name, exc, exc_info=True
            )
        finally:
            self._last_run_id = None

        data["run_id"] = run_id
        if latency_ms is not None:
            data["latency_ms"] = latency_ms
        return data


def get_user_attr(user: Any, attr: str, default: Any | None = None) -> Any | None:
    """Safely extract an attribute from a user object or mapping."""

    if isinstance(user, dict):
        return user.get(attr, default)
    return getattr(user, attr, default)


def get_user_id(user: Any) -> int:
    """Return the authenticated user's ID, raising if unavailable."""

    value = get_user_attr(user, "id")
    if value is None:
        raise ValueError("Authenticated user does not expose an id attribute")
    return int(value)


async def prepare_chat_messages(history: List[dict]) -> List[LLMChatMessage]:
    """Prepare chat messages for agent loop."""
    messages = []
    for msg in history:
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            messages.append(LLMChatMessage(role=msg["role"], content=msg["content"]))
    return messages


def resolve_assistant_language(language: Optional[str], *, default: Optional[str] = None) -> str:
    """Resolve assistant language from request, falling back to configured defaults."""
    chosen = (language or "").strip().lower()
    if chosen:
        return chosen
    fallback = (default or getattr(api_settings, "agent_default_language", None) or "").strip()
    return fallback.lower() or "en"


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
    recorder = ToolEventRecorder(user_id=user_id, session_id=session_id)
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
            data = await recorder.record(data)
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
