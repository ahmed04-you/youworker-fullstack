"""
Chat-related API endpoints.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from httpx import HTTPStatusError
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.audio_pipeline import transcribe_audio_pcm16, synthesize_speech
from apps.api.auth.security import get_current_active_user, sanitize_input
from apps.api.routes.deps import get_agent_loop
from packages.llm import ChatMessage
from packages.agent import AgentLoop
from packages.db import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")
limiter = Limiter(key_func=get_remote_address)

SUPPORTED_ASSISTANT_LANGUAGES = {"it", "en"}

HEARTBEAT_INTERVAL_SECONDS = 15


def _format_sse(event: dict[str, Any], pad: bool = False) -> str:
    """Encode an SSE frame with optional initial padding."""
    event_name = event.get("event", "message")
    payload = event.get("data", {})
    lines = [
        f"event: {event_name}",
        f"data: {json.dumps(payload, ensure_ascii=False)}",
    ]
    if pad:
        lines.append(": " + (" " * 2048))
    return "\n".join(lines) + "\n\n"


def _resolve_assistant_language(requested: str | None) -> str:
    candidate = (requested or settings.agent_default_language).strip().lower()
    if candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    fallback = settings.agent_default_language.strip().lower()
    if fallback in SUPPORTED_ASSISTANT_LANGUAGES:
        if candidate:
            logger.debug(
                "Unsupported assistant language '%s'; falling back to '%s'",
                candidate,
                fallback,
            )
        return fallback

    if candidate and candidate in SUPPORTED_ASSISTANT_LANGUAGES:
        return candidate

    if fallback:
        logger.debug(
            "Fallback assistant language '%s' is unsupported; defaulting to 'it'",
            fallback,
        )
    return "it"


def _prepare_chat_messages(raw_messages: list[dict[str, Any]]) -> list[ChatMessage]:
    """Convert raw payload messages into sanitized ChatMessage objects."""
    prepared: list[ChatMessage] = []
    for msg in raw_messages or []:
        role = (msg.get("role") or "user").strip().lower()
        if role not in {"user", "assistant", "system", "tool"}:
            role = "user"
        content = msg.get("content", "") or ""
        if role in {"user", "system"}:
            content = sanitize_input(content)
        prepared.append(ChatMessage(role=role, content=content))
    return prepared


# Request/Response models
class ChatRequest(BaseModel):
    """Chat request model."""

    messages: list[dict[str, str]]  # [{role, content}]
    session_id: str | None = None
    stream: bool = True
    enable_tools: bool = True
    model: str | None = None
    assistant_language: str | None = None


class UnifiedChatRequest(BaseModel):
    """Unified chat request that supports both text and audio input."""

    messages: list[dict[str, str]]
    text_input: str | None = None
    audio_b64: str | None = None
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = False
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    stream: bool = True
    assistant_language: str | None = None


class UnifiedChatResponse(BaseModel):
    """Unified chat response payload."""

    content: str
    transcript: str | None = None
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None


class VoiceTurnRequest(BaseModel):
    """Turn-based voice interaction request."""

    messages: list[dict[str, str]]
    audio_b64: str
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    expect_audio: bool = True
    enable_tools: bool = True
    session_id: str | None = None
    model: str | None = None
    assistant_language: str | None = None


class VoiceTurnResponse(BaseModel):
    """Voice turn response payload."""

    transcript: str
    assistant_text: str
    metadata: dict[str, Any]
    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    stt_confidence: float | None = None
    stt_language: str | None = None
    tool_events: list[dict[str, Any]] = Field(default_factory=list)
    logs: list[dict[str, str]] = Field(default_factory=list)
    assistant_language: str | None = None


async def persist_last_user_message(
    db: AsyncSession,
    session: Any,
    messages: list[ChatMessage],
) -> None:
    """Persist the most recent user-authored message if present."""
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
    """Record tool start and return the run identifier."""
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
    """Finalize tool run bookkeeping if a start was recorded."""
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
    """Store the assistant's final response."""
    from packages.db.crud import add_message

    await add_message(db, session_id=session_id, role="assistant", content=final_text)


async def _get_current_user(current_user=Depends(get_current_active_user)):
    """Get current authenticated user."""
    user = current_user
    # Ensure root has access to default collection
    try:
        from packages.vectorstore.schema import DEFAULT_COLLECTION
        from packages.db.crud import grant_user_collection_access

        async with get_async_session() as db:
            await grant_user_collection_access(
                db, user_id=user.id, collection_name=DEFAULT_COLLECTION
            )
    except (AttributeError, ImportError, ValueError) as e:
        logger.debug(f"Could not grant default collection access: {e}")
        pass
    return {"id": user.id, "username": user.username, "is_root": user.is_root}


@router.post("/chat")
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    current_user=Depends(_get_current_user),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Chat endpoint with streaming support and tool calling.

    IMPORTANT: This implements the strict single-tool stepper pattern.
    - Tool calls are executed internally
    - Only final answers are streamed to the client
    - Thinking traces are captured but NOT streamed
    """
    messages = _prepare_chat_messages(chat_request.messages)

    assistant_language = _resolve_assistant_language(chat_request.assistant_language)
    request_model = chat_request.model or settings.chat_model

    logger.info(
        "Chat request: %s messages, tools=%s, language=%s",
        len(messages),
        chat_request.enable_tools,
        assistant_language,
    )

    if chat_request.stream:

        async def generate():
            """Generate SSE stream."""
            pad_pending = True
            last_tool_run_id: int | None = None

            try:
                async with get_async_session() as db:
                    from packages.db.crud import get_or_create_session

                    session = await get_or_create_session(
                        db,
                        user_id=current_user["id"],
                        external_id=chat_request.session_id,
                        model=request_model,
                        enable_tools=chat_request.enable_tools,
                    )
                    await persist_last_user_message(db, session, messages)
                    chat_session_id = session.id

                event_iterator = agent_loop.run_until_completion(
                    messages=messages,
                    enable_tools=chat_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
                    model=request_model,
                ).__aiter__()

                while True:
                    try:
                        event = await asyncio.wait_for(
                            event_iterator.__anext__(),
                            timeout=HEARTBEAT_INTERVAL_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        heartbeat = {"event": "heartbeat", "data": {}}
                        yield _format_sse(heartbeat, pad=pad_pending)
                        pad_pending = False
                        await asyncio.sleep(0)
                        continue
                    except StopAsyncIteration:
                        break

                    pad = pad_pending
                    pad_pending = False

                    event_type = event.get("event")
                    if event_type == "tool":
                        data = event.get("data", {}) or {}
                        ts_raw = data.get("ts")
                        try:
                            parsed_ts = (
                                datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
                            )
                        except (TypeError, ValueError):
                            logger.warning("Invalid tool timestamp '%s'", ts_raw)
                            parsed_ts = datetime.utcnow()

                        if data.get("status") == "start":
                            async with get_async_session() as db:
                                last_tool_run_id = await record_tool_start(
                                    db,
                                    user_id=current_user["id"],
                                    session_id=None,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=parsed_ts,
                                )
                        else:
                            latency_val = data.get("latency_ms")
                            latency_ms = None
                            if isinstance(latency_val, (int, float)):
                                latency_ms = int(latency_val)

                            async with get_async_session() as db:
                                await record_tool_end(
                                    db,
                                    run_id=last_tool_run_id,
                                    status=data.get("status"),
                                    end_ts=parsed_ts,
                                    latency_ms=latency_ms,
                                    result_preview=(data.get("result_preview") or None),
                                    tool_name=data.get("tool"),
                                )
                            last_tool_run_id = None

                    elif event_type == "done":
                        payload = event.setdefault("data", {})
                        if not isinstance(payload, dict):
                            payload = {}
                            event["data"] = payload

                        metadata = payload.get("metadata") or {}
                        if not isinstance(metadata, dict):
                            metadata = {}
                        metadata["assistant_language"] = assistant_language
                        payload["metadata"] = metadata

                        final = payload.get("final_text") or ""
                        async with get_async_session() as db:
                            await persist_final_assistant_message(db, chat_session_id, final)

                    elif event_type == "log":
                        payload = event.setdefault("data", {})
                        if isinstance(payload, dict):
                            payload.setdefault("assistant_language", assistant_language)

                    yield _format_sse(event, pad=pad)
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during chat: %s", error_msg)
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                        "assistant_language": assistant_language,
                    },
                }
                yield _format_sse(log_frame, pad=pad_pending)
                pad_pending = False
                done_frame = {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "status": "error",
                            "error": error_msg,
                            "assistant_language": assistant_language,
                        },
                        "final_text": f"Errore: {error_msg}",
                    },
                }
                yield _format_sse(done_frame, pad=False)
            except Exception as e:  # pragma: no cover - defensive
                error_msg = str(e)
                logger.error("Error during chat: %s", error_msg)
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                        "assistant_language": assistant_language,
                    },
                }
                yield _format_sse(log_frame, pad=pad_pending)
                pad_pending = False
                done_frame = {
                    "event": "done",
                    "data": {
                        "metadata": {
                            "status": "error",
                            "error": error_msg,
                            "assistant_language": assistant_language,
                        },
                        "final_text": f"Errore: {error_msg}",
                    },
                }
                yield _format_sse(done_frame, pad=False)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming response
    collected_chunks: list[str] = []
    final_text: str | None = None
    metadata: dict[str, Any] = {"assistant_language": assistant_language}

    async for event in agent_loop.run_until_completion(
        messages=messages,
        enable_tools=chat_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
        model=request_model,
    ):
        if event.get("event") == "token":
            text = event.get("data", {}).get("text", "")
            collected_chunks.append(text)
        elif event.get("event") == "done":
            payload = event.get("data", {}) or {}
            meta = payload.get("metadata") or {}
            if isinstance(meta, dict):
                metadata.update(meta)
            metadata["assistant_language"] = assistant_language
            final_text = payload.get("final_text", final_text)

    response_text = final_text if final_text is not None else "".join(collected_chunks)

    async with get_async_session() as db:
        from packages.db.crud import get_or_create_session

        session = await get_or_create_session(
            db,
            user_id=current_user["id"],
            external_id=chat_request.session_id,
            model=request_model,
            enable_tools=chat_request.enable_tools,
        )
        await persist_final_assistant_message(db, session.id, response_text)

    return {"content": response_text, "metadata": metadata}


@router.post("/voice-turn", response_model=VoiceTurnResponse)
@limiter.limit("20/minute")
async def voice_turn_endpoint(
    request: Request,
    voice_request: VoiceTurnRequest,
    current_user=Depends(_get_current_user),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Turn-based voice endpoint that handles audio transcription, agent reasoning,
    and optional TTS synthesis.
    """
    import base64

    try:
        audio_bytes = base64.b64decode(voice_request.audio_b64)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

    try:
        stt_result = await transcribe_audio_pcm16(audio_bytes, voice_request.sample_rate)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Voice transcription failed: %s", exc)
        raise HTTPException(status_code=500, detail="Transcription failed")

    transcript_raw = (stt_result.get("text") or "").strip()
    transcript = sanitize_input(transcript_raw)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcription produced empty text")

    # Build conversation history and append the new user message
    conversation: list[ChatMessage] = _prepare_chat_messages(voice_request.messages)
    conversation.append(ChatMessage(role="user", content=transcript))

    assistant_language = _resolve_assistant_language(voice_request.assistant_language)
    request_model = voice_request.model or settings.chat_model

    # Persist user turn
    chat_session_id: int | None = None
    async with get_async_session() as db:
        from packages.db.crud import get_or_create_session

        chat_session = await get_or_create_session(
            db,
            user_id=current_user["id"],
            external_id=voice_request.session_id,
            model=request_model,
            enable_tools=voice_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await persist_last_user_message(db, chat_session, conversation)

    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []
    pending_tool_run: int | None = None

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=voice_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
        model=request_model,
    ):
        etype = event.get("event")
        data = event.get("data", {}) or {}

        if etype == "token":
            final_text += data.get("text", "")

        elif etype == "tool":
            tool_events.append(data)
            status = data.get("status")
            ts_raw = data.get("ts")
            try:
                parsed_ts = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
            except (ValueError, TypeError) as e:
                logger.warning("Invalid timestamp format: %s", e)
                parsed_ts = datetime.utcnow()

            if status == "start":
                async with get_async_session() as db:
                    pending_tool_run = await record_tool_start(
                        db,
                        user_id=current_user["id"],
                        session_id=chat_session_id,
                        tool_name=data.get("tool"),
                        args=data.get("args"),
                        start_ts=parsed_ts,
                    )
            else:
                if pending_tool_run is not None:
                    latency_val = data.get("latency_ms")
                    latency_ms = None
                    if isinstance(latency_val, (int, float)):
                        latency_ms = int(latency_val)

                    async with get_async_session() as db:
                        await record_tool_end(
                            db,
                            run_id=pending_tool_run,
                            status=status,
                            end_ts=parsed_ts,
                            latency_ms=latency_ms,
                            result_preview=(data.get("result_preview") or None),
                            tool_name=data.get("tool"),
                        )
                    pending_tool_run = None

        elif etype == "log":
            logs.append(
                {
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", ""),
                    "assistant_language": assistant_language,
                }
            )

        elif etype == "done":
            meta = data.get("metadata", {}) or {}
            if isinstance(meta, dict):
                metadata.setdefault("assistant_language", assistant_language)
                metadata.update(meta)
            if not final_text:
                final_text = data.get("final_text", "") or ""

    metadata = metadata or {}
    if isinstance(metadata, dict):
        metadata.setdefault("assistant_language", assistant_language)
    final_text = (final_text or "").strip()

    if chat_session_id is not None and final_text:
        async with get_async_session() as db:
            await persist_final_assistant_message(db, chat_session_id, final_text)

    audio_b64: str | None = None
    audio_sample_rate: int | None = None

    if voice_request.expect_audio and final_text:
        try:
            synth_result = await synthesize_speech(final_text)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Voice synthesis failed: %s", exc)

    return VoiceTurnResponse(
        transcript=transcript,
        assistant_text=final_text,
        metadata=metadata,
        audio_b64=audio_b64,
        audio_sample_rate=audio_sample_rate,
        stt_confidence=stt_result.get("confidence"),
        stt_language=stt_result.get("language"),
        tool_events=tool_events,
        logs=logs,
        assistant_language=assistant_language,
    )


@router.post("/unified-chat", response_model=UnifiedChatResponse)
@limiter.limit("30/minute")
async def unified_chat_endpoint(
    request: Request,
    unified_request: UnifiedChatRequest,
    current_user=Depends(_get_current_user),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Unified chat endpoint that supports both text and audio input.

    Handles three scenarios:
    1. Text input only -> uses chat streaming
    2. Audio input only -> transcribes and processes
    3. Both text and audio -> prioritizes text input

    Always returns text response, optionally with audio.
    """
    if unified_request.text_input and unified_request.text_input.strip():
        text_content = sanitize_input(unified_request.text_input)
        transcript = None
        stt_confidence = None
        stt_language = None
    elif unified_request.audio_b64:
        try:
            import base64

            audio_bytes = base64.b64decode(unified_request.audio_b64)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

        try:
            stt_result = await transcribe_audio_pcm16(audio_bytes, unified_request.sample_rate)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Voice transcription failed: %s", exc)
            raise HTTPException(status_code=500, detail="Transcription failed")

        detected_text = (stt_result.get("text") or "").strip()
        text_content = sanitize_input(detected_text)
        transcript = text_content
        stt_confidence = stt_result.get("confidence")
        stt_language = stt_result.get("language")

        if not text_content:
            raise HTTPException(status_code=400, detail="Transcription produced empty text")
    else:
        raise HTTPException(
            status_code=400, detail="Either text_input or audio_b64 must be provided"
        )

    conversation: list[ChatMessage] = _prepare_chat_messages(unified_request.messages)
    conversation.append(ChatMessage(role="user", content=text_content))

    assistant_language = _resolve_assistant_language(unified_request.assistant_language)
    request_model = unified_request.model or settings.chat_model

    async with get_async_session() as db:
        from packages.db.crud import get_or_create_session

        chat_session = await get_or_create_session(
            db,
            user_id=current_user["id"],
            external_id=unified_request.session_id,
            model=request_model,
            enable_tools=unified_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await persist_last_user_message(db, chat_session, conversation)

    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []

    if unified_request.stream:

        async def generate():
            pad_pending = True
            collected_chunks: list[str] = []
            last_tool_run_id: int | None = None
            local_final_text = ""
            local_metadata: dict[str, Any] = {"assistant_language": assistant_language}

            try:
                event_iterator = agent_loop.run_until_completion(
                    messages=conversation,
                    enable_tools=unified_request.enable_tools,
                    max_iterations=settings.max_agent_iterations,
                    language=assistant_language,
                    model=request_model,
                ).__aiter__()

                while True:
                    try:
                        event = await asyncio.wait_for(
                            event_iterator.__anext__(),
                            timeout=HEARTBEAT_INTERVAL_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        heartbeat = {"event": "heartbeat", "data": {}}
                        yield _format_sse(heartbeat, pad=pad_pending)
                        pad_pending = False
                        await asyncio.sleep(0)
                        continue
                    except StopAsyncIteration:
                        break

                    pad = pad_pending
                    pad_pending = False

                    event_type = event.get("event")
                    data = event.get("data", {}) or {}

                    if event_type == "tool":
                        tool_events.append(data)
                        ts_raw = data.get("ts")
                        try:
                            parsed_ts = (
                                datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
                            )
                        except (ValueError, TypeError) as exc:
                            logger.warning("Invalid timestamp format: %s", exc)
                            parsed_ts = datetime.utcnow()

                        if data.get("status") == "start":
                            async with get_async_session() as db:
                                last_tool_run_id = await record_tool_start(
                                    db,
                                    user_id=current_user["id"],
                                    session_id=chat_session_id,
                                    tool_name=data.get("tool"),
                                    args=data.get("args"),
                                    start_ts=parsed_ts,
                                )
                        else:
                            latency_val = data.get("latency_ms")
                            latency_ms = None
                            if isinstance(latency_val, (int, float)):
                                latency_ms = int(latency_val)

                            async with get_async_session() as db:
                                await record_tool_end(
                                    db,
                                    run_id=last_tool_run_id,
                                    status=data.get("status"),
                                    end_ts=parsed_ts,
                                    latency_ms=latency_ms,
                                    result_preview=(data.get("result_preview") or None),
                                    tool_name=data.get("tool"),
                                )
                            last_tool_run_id = None

                    elif event_type == "token":
                        if isinstance(data, dict):
                            data.setdefault("assistant_language", assistant_language)
                            text = data.get("text", "")
                        else:
                            text = ""
                        collected_chunks.append(text)

                    elif event_type == "log":
                        if isinstance(data, dict):
                            data.setdefault("assistant_language", assistant_language)
                            logs.append(data.copy())
                        else:
                            logs.append(
                                {
                                    "level": "info",
                                    "msg": "",
                                    "assistant_language": assistant_language,
                                }
                            )

                    elif event_type == "done":
                        if not isinstance(data, dict):
                            data = {}
                            event["data"] = data

                        meta = data.get("metadata") or {}
                        if not isinstance(meta, dict):
                            meta = {}
                        meta["assistant_language"] = assistant_language
                        local_metadata = meta
                        data["metadata"] = meta

                        final_piece = data.get("final_text") or ""
                        if not local_final_text:
                            local_final_text = "".join(collected_chunks) + final_piece
                        persisted_text = local_final_text or "".join(collected_chunks)

                        async with get_async_session() as db:
                            await persist_final_assistant_message(
                                db, chat_session_id, persisted_text
                            )

                        audio_b64 = None
                        audio_sample_rate = None
                        if unified_request.expect_audio and persisted_text:
                            try:
                                synth_result = await synthesize_speech(persisted_text)
                                if synth_result:
                                    import base64

                                    wav_bytes, sr = synth_result
                                    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                                    audio_sample_rate = sr
                            except Exception as exc:  # pragma: no cover - defensive
                                logger.error("Voice synthesis failed: %s", exc)

                        response = UnifiedChatResponse(
                            content=persisted_text,
                            transcript=transcript,
                            metadata=local_metadata,
                            audio_b64=audio_b64,
                            audio_sample_rate=audio_sample_rate,
                            stt_confidence=stt_confidence,
                            stt_language=stt_language,
                            tool_events=tool_events,
                            logs=logs,
                            assistant_language=assistant_language,
                        )
                        event["data"] = response.model_dump()

                    yield _format_sse(event, pad=pad)
                    await asyncio.sleep(0)

            except HTTPStatusError as e:
                error_msg = f"Ollama error ({e.response.status_code}): {e.response.text.strip()}"
                logger.error("Error during unified chat: %s", error_msg)
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                        "assistant_language": assistant_language,
                    },
                }
                yield _format_sse(log_frame, pad=pad_pending)
                pad_pending = False
                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=transcript,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                        "assistant_language": assistant_language,
                    },
                    audio_b64=None,
                    audio_sample_rate=None,
                    stt_confidence=stt_confidence,
                    stt_language=stt_language,
                    tool_events=tool_events,
                    logs=logs,
                    assistant_language=assistant_language,
                )
                yield _format_sse({"event": "done", "data": error_response.model_dump()}, pad=False)
            except Exception as e:  # pragma: no cover - defensive
                error_msg = str(e)
                logger.error("Error during unified chat: %s", error_msg)
                log_frame = {
                    "event": "log",
                    "data": {
                        "level": "error",
                        "msg": error_msg,
                        "assistant_language": assistant_language,
                    },
                }
                yield _format_sse(log_frame, pad=pad_pending)
                pad_pending = False
                error_response = UnifiedChatResponse(
                    content=f"Errore: {error_msg}",
                    transcript=transcript,
                    metadata={
                        "status": "error",
                        "error": error_msg,
                        "assistant_language": assistant_language,
                    },
                    audio_b64=None,
                    audio_sample_rate=None,
                    stt_confidence=stt_confidence,
                    stt_language=stt_language,
                    tool_events=tool_events,
                    logs=logs,
                    assistant_language=assistant_language,
                )
                yield _format_sse({"event": "done", "data": error_response.model_dump()}, pad=False)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    pending_tool_run: int | None = None

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=unified_request.enable_tools,
        max_iterations=settings.max_agent_iterations,
        language=assistant_language,
        model=request_model,
    ):
        etype = event.get("event")
        data = event.get("data", {}) or {}

        if etype == "token":
            final_text += data.get("text", "")
        elif etype == "tool":
            tool_events.append(data)
            status = data.get("status")
            ts_raw = data.get("ts")
            try:
                parsed_ts = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()
            except (ValueError, TypeError) as exc:
                logger.warning("Invalid timestamp format: %s", exc)
                parsed_ts = datetime.utcnow()

            if status == "start":
                async with get_async_session() as db:
                    pending_tool_run = await record_tool_start(
                        db,
                        user_id=current_user["id"],
                        session_id=chat_session_id,
                        tool_name=data.get("tool"),
                        args=data.get("args"),
                        start_ts=parsed_ts,
                    )
            else:
                if pending_tool_run is not None:
                    latency_val = data.get("latency_ms")
                    latency_ms = None
                    if isinstance(latency_val, (int, float)):
                        latency_ms = int(latency_val)

                    async with get_async_session() as db:
                        await record_tool_end(
                            db,
                            run_id=pending_tool_run,
                            status=status,
                            end_ts=parsed_ts,
                            latency_ms=latency_ms,
                            result_preview=(data.get("result_preview") or None),
                            tool_name=data.get("tool"),
                        )
                    pending_tool_run = None

        elif etype == "log":
            logs.append(
                {
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", ""),
                    "assistant_language": assistant_language,
                }
            )

        elif etype == "done":
            meta = data.get("metadata", {}) or {}
            if isinstance(meta, dict):
                metadata.update(meta)
            metadata["assistant_language"] = assistant_language
            if not final_text:
                final_text = data.get("final_text", "") or ""

    metadata = metadata or {}
    if isinstance(metadata, dict):
        metadata.setdefault("assistant_language", assistant_language)
    final_text = (final_text or "").strip()

    if final_text:
        async with get_async_session() as db:
            await persist_final_assistant_message(db, chat_session_id, final_text)

    audio_b64: str | None = None
    audio_sample_rate: int | None = None
    if unified_request.expect_audio and final_text:
        try:
            synth_result = await synthesize_speech(final_text)
            if synth_result:
                import base64

                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Voice synthesis failed: %s", exc)

    response = UnifiedChatResponse(
        content=final_text,
        transcript=transcript,
        metadata=metadata,
        audio_b64=audio_b64,
        audio_sample_rate=audio_sample_rate,
        stt_confidence=stt_confidence,
        stt_language=stt_language,
        tool_events=tool_events,
        logs=logs,
        assistant_language=assistant_language,
    )

    return response
