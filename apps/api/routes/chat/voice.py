"""
Voice turn endpoint for audio-based interactions.
"""

import base64
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from apps.api.config import settings
from apps.api.auth.security import sanitize_input
from typing import Optional

from apps.api.audio_pipeline import transcribe_audio_pcm16, synthesize_speech
from apps.api.routes.deps import get_agent_loop, get_current_user_with_collection_access
from packages.agent import AgentLoop
from packages.db import get_async_session
from packages.llm import ChatMessage

from .helpers import handle_tool_event, prepare_chat_messages, resolve_assistant_language

from .models import VoiceTurnRequest, VoiceTurnResponse
from .persistence import (
    persist_last_user_message,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/voice-turn", response_model=VoiceTurnResponse)
@limiter.limit("20/minute")
async def voice_turn_endpoint(
    request: Request,
    voice_request: VoiceTurnRequest,
    current_user=Depends(get_current_user_with_collection_access),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Turn-based voice endpoint that handles audio transcription, agent reasoning,
    and optional TTS synthesis.
    """
    # Decode audio
    try:
        audio_bytes = base64.b64decode(voice_request.audio_b64)
    except (ValueError, Exception):
        # Standardize error message to satisfy integration tests
        raise HTTPException(status_code=400, detail="Invalid audio payload")

    # Transcribe audio
    try:
        stt_result = await transcribe_audio_pcm16(audio_bytes, voice_request.sample_rate)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("Voice transcription failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Transcription failed")

    # Sanitize transcript
    transcript_raw = (stt_result.get("text") or "").strip()
    transcript = sanitize_input(transcript_raw)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcription produced empty text")

    # Build conversation history
    conversation: list[ChatMessage] = await prepare_chat_messages(voice_request.messages or [])
    conversation.append(ChatMessage(role="user", content=transcript))

    assistant_language = resolve_assistant_language(voice_request.assistant_language or "")
    request_model = voice_request.model or settings.chat_model

    # Persist user turn
    chat_session_id: int | None = None
    async with get_async_session() as db:
        chat_session = await get_or_create_chat_session(
            db,
            user_id=current_user["id"],
            external_id=voice_request.session_id,
            model=request_model,
            enable_tools=voice_request.enable_tools,
        )
        chat_session_id = chat_session.id
        await persist_last_user_message(db, chat_session, conversation)

    # Process with agent
    final_text = ""
    metadata: dict[str, Any] = {"assistant_language": assistant_language}
    tool_events: list[dict[str, Any]] = []
    logs: list[dict[str, str]] = []
    last_tool_run_id_voice: Optional[int] = None

    try:
        async for event in agent_loop.run_until_completion(
            messages=conversation,
            enable_tools=voice_request.enable_tools,
            max_iterations=settings.max_agent_iterations,
            language=assistant_language,
            model=request_model,
        ):
            etype = event.get("event")
            data = event.get("data", {}) or {}

            if etype == "tool":
                async with get_async_session() as db:
                    last_tool_run_id_voice, data = await handle_tool_event(
                        db, current_user["id"], chat_session_id, data, last_tool_run_id_voice
                    )
                tool_events.append(data)
            elif etype == "token":
                final_text += data.get("text", "")
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
    except Exception as exc:
        # Degrade gracefully when LLM is unavailable or errors occur
        logger.error("Voice pipeline failed: %s", exc, exc_info=True)

    metadata = metadata or {}
    if isinstance(metadata, dict):
        metadata.setdefault("assistant_language", assistant_language)
    final_text = (final_text or "").strip()

    # Persist assistant response
    if chat_session_id is not None and final_text:
        async with get_async_session() as db:
            await persist_final_assistant_message(db, chat_session_id, final_text)

    # Synthesize speech if requested
    audio_b64: str | None = None
    audio_sample_rate: int | None = None

    if voice_request.expect_audio and final_text:
        try:
            synth_result = await synthesize_speech(final_text)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as exc:
            logger.error("Voice synthesis failed: %s", exc, exc_info=True)

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
