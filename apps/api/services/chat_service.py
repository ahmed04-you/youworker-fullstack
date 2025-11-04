"""
Chat service layer for business logic.

This service encapsulates all business logic for chat operations,
separating concerns from HTTP routing and enabling better testability.
"""

import base64
import logging
from typing import Any, AsyncIterator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.auth.security import sanitize_input
from apps.api.audio_pipeline import (
    sanitize_tts_text,
    synthesize_speech,
    transcribe_audio_pcm16,
)
from packages.agent import AgentLoop
from packages.llm import ChatMessage
from packages.db.models import ChatSession

from .base import BaseService
from ..routes.chat.helpers import ToolEventRecorder, prepare_chat_messages, get_user_id
from ..routes.chat.persistence import (
    persist_last_user_message,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)


class InputProcessingResult:
    """Result of input processing (text or audio)."""

    def __init__(
        self,
        text_content: str,
        transcript: str | None = None,
        stt_confidence: float | None = None,
        stt_language: str | None = None,
    ):
        self.text_content = text_content
        self.transcript = transcript
        self.stt_confidence = stt_confidence
        self.stt_language = stt_language


class ChatResponse:
    """Response from chat operation."""

    def __init__(
        self,
        content: str,
        metadata: dict[str, Any] | None = None,
        audio_b64: str | None = None,
        audio_sample_rate: int | None = None,
        transcript: str | None = None,
        stt_confidence: float | None = None,
        stt_language: str | None = None,
        tool_events: list[dict[str, Any]] | None = None,
        logs: list[dict[str, str]] | None = None,
    ):
        self.content = content
        self.metadata = metadata or {}
        self.audio_b64 = audio_b64
        self.audio_sample_rate = audio_sample_rate
        self.transcript = transcript
        self.stt_confidence = stt_confidence
        self.stt_language = stt_language
        self.tool_events = tool_events or []
        self.logs = logs or []


class ChatService(BaseService):
    """
    Business logic for chat operations.

    This service orchestrates:
    - Input processing (text or audio)
    - Session management
    - Agent execution
    - Audio synthesis
    - Message persistence
    """

    def __init__(
        self,
        db_session: AsyncSession,
        agent_loop: AgentLoop,
        settings_instance: "Settings | None" = None,
    ):
        """
        Initialize chat service.

        Args:
            db_session: Database session for persistence
            agent_loop: Agent execution engine
            settings_instance: Application settings
        """
        from apps.api.config import settings as app_settings, Settings

        super().__init__(db_session, settings_instance or app_settings)
        self.agent_loop = agent_loop

    async def process_text_or_audio_input(
        self,
        text_input: str | None,
        audio_b64: str | None,
        sample_rate: int = 16000,
    ) -> InputProcessingResult:
        """
        Process text or audio input.

        Args:
            text_input: Optional text input
            audio_b64: Optional base64-encoded audio
            sample_rate: Audio sample rate (default: 16000)

        Returns:
            InputProcessingResult with processed text and metadata

        Raises:
            ValueError: If neither input provided or invalid data
            RuntimeError: If transcription fails
        """
        # Handle text input
        if text_input and text_input.strip():
            text_content = sanitize_input(text_input)
            return InputProcessingResult(text_content=text_content)

        # Handle audio input
        if audio_b64:
            try:
                audio_bytes = base64.b64decode(audio_b64)
            except (ValueError, Exception) as e:
                raise ValueError(f"Invalid base64 audio payload: {e}")

            try:
                stt_result = await transcribe_audio_pcm16(audio_bytes, sample_rate)
            except RuntimeError as exc:
                raise RuntimeError(f"Transcription service unavailable: {exc}")
            except Exception as exc:
                logger.error("Voice transcription failed", extra={"error": str(exc)}, exc_info=True)
                raise RuntimeError("Transcription failed")

            detected_text = (stt_result.get("text") or "").strip()
            text_content = sanitize_input(detected_text)

            if not text_content:
                raise ValueError("Transcription produced empty text")

            return InputProcessingResult(
                text_content=text_content,
                transcript=text_content,
                stt_confidence=stt_result.get("confidence"),
                stt_language=stt_result.get("language"),
            )

        raise ValueError("Either text_input or audio_b64 must be provided")

    async def get_or_create_session(
        self,
        user_id: int,
        external_id: str,
        model: str,
        enable_tools: bool,
    ) -> ChatSession:
        """
        Get existing chat session or create a new one.

        Args:
            user_id: User identifier
            external_id: External session identifier
            model: Model name to use
            enable_tools: Whether tools are enabled

        Returns:
            ChatSession instance
        """
        return await get_or_create_chat_session(
            self.db,
            user_id=user_id,
            external_id=external_id,
            model=model,
            enable_tools=enable_tools,
        )

    async def prepare_conversation(
        self,
        messages: list[dict[str, Any]],
        user_message: str,
    ) -> list[ChatMessage]:
        """
        Prepare conversation history for agent.

        Args:
            messages: Previous message history
            user_message: Current user message

        Returns:
            List of ChatMessage objects
        """
        conversation = await prepare_chat_messages(messages or [])
        conversation.append(ChatMessage(role="user", content=user_message))
        return conversation

    async def execute_agent(
        self,
        conversation: list[ChatMessage],
        enable_tools: bool,
        max_iterations: int,
        model: str,
        disable_web: bool = False,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Execute agent with conversation.

        Args:
            conversation: Message history
            enable_tools: Whether to enable tool usage
            max_iterations: Maximum agent iterations
            model: Model name
            disable_web: Whether to disable web MCP tools

        Yields:
            Agent events (tool, token, log, done)
        """
        async for event in self.agent_loop.run_until_completion(
            messages=conversation,
            enable_tools=enable_tools,
            max_iterations=max_iterations,
            model=model,
            disable_web=disable_web,
        ):
            yield event

    async def synthesize_audio(
        self,
        text: str,
    ) -> tuple[str, int] | None:
        """
        Synthesize speech from text using MeloTTS.

        Args:
            text: Text to synthesize

        Returns:
            Tuple of (base64_audio, sample_rate) or None if failed
        """
        if not text:
            return None

        try:
            synth_result = await synthesize_speech(text)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                return audio_b64, sr
        except Exception as exc:
            logger.error(
                "Voice synthesis failed",
                extra={"error": str(exc), "text_length": len(text)},
                exc_info=True,
            )

        return None

    async def persist_user_message(
        self,
        chat_session: ChatSession,
        conversation: list[ChatMessage],
    ) -> None:
        """
        Persist user message to database.

        Args:
            chat_session: Active chat session
            conversation: Conversation history
        """
        await persist_last_user_message(self.db, chat_session, conversation)

    async def persist_assistant_message(
        self,
        chat_session_id: int,
        content: str,
    ) -> None:
        """
        Persist assistant message to database.

        Args:
            chat_session_id: Session ID
            content: Message content
        """
        if content:
            await persist_final_assistant_message(self.db, chat_session_id, content)

    async def send_message(
        self,
        user: Any,
        text_input: str | None = None,
        audio_b64: str | None = None,
        sample_rate: int = 16000,
        session_id: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        enable_tools: bool = True,
        expect_audio: bool = False,
        disable_web: bool = False,
        max_iterations: int | None = None,
    ) -> ChatResponse:
        """
        Send a message and get agent response (non-streaming).

        This is the main business logic method that orchestrates:
        1. Input processing (text or audio)
        2. Session management
        3. Message preparation
        4. Agent execution
        5. Audio synthesis (if requested)
        6. Message persistence

        Args:
            user: Authenticated user object
            text_input: Optional text input
            audio_b64: Optional base64-encoded audio
            sample_rate: Audio sample rate
            session_id: Optional session identifier
            messages: Previous message history
            model: Model to use (defaults to settings)
            enable_tools: Whether to enable tool usage
            expect_audio: Whether to synthesize audio response
            max_iterations: Maximum agent iterations (defaults to settings)

        Returns:
            ChatResponse with all results

        Raises:
            ValueError: Invalid input
            RuntimeError: Processing errors
        """
        # Process input
        input_result = await self.process_text_or_audio_input(
            text_input=text_input,
            audio_b64=audio_b64,
            sample_rate=sample_rate,
        )

        transcript_info: dict[str, Any] | None = None
        if input_result.transcript:
            transcript_info = {
                "text": input_result.transcript,
                "language": input_result.stt_language,
                "confidence": input_result.stt_confidence,
            }

        # Get user ID
        user_id = get_user_id(user)

        # Determine model and iterations
        request_model = model or self.settings.chat_model
        max_iters = max_iterations or self.settings.max_agent_iterations

        # Determine external session identifier (use provided value or generate a stable UUID)
        session_identifier = str(session_id) if session_id else str(uuid4())

        # Get or create session
        chat_session = await self.get_or_create_session(
            user_id=user_id,
            external_id=session_identifier,
            model=request_model,
            enable_tools=enable_tools,
        )

        # Ensure session has a stable external identifier
        if chat_session.external_id != session_identifier:
            chat_session.external_id = session_identifier
            await self.db.flush()

        # Prepare conversation
        conversation = await self.prepare_conversation(
            messages=messages or [],
            user_message=input_result.text_content,
        )

        # Persist user message
        await self.persist_user_message(chat_session, conversation)

        # Execute agent (non-streaming)
        final_text = ""
        metadata: dict[str, Any] = {}
        tool_events: list[dict[str, Any]] = []
        logs: list[dict[str, str]] = []
        tool_recorder = ToolEventRecorder(user_id=user_id, session_id=chat_session.id)

        async for event in self.execute_agent(
            conversation=conversation,
            enable_tools=enable_tools,
            max_iterations=max_iters,
            model=request_model,
            disable_web=disable_web,
        ):
            etype = event.get("event")
            data = event.get("data", {}) or {}

            if etype == "tool":
                data = await tool_recorder.record(data)
                tool_events.append(data)
            elif etype == "token":
                final_text += data.get("text", "")
            elif etype == "log":
                logs.append(
                    {
                        "level": data.get("level", "info"),
                        "msg": data.get("msg", ""),
                    }
                )
            elif etype == "done":
                meta = data.get("metadata", {}) or {}
                if isinstance(meta, dict):
                    metadata.update(meta)
                if not final_text:
                    final_text = data.get("final_text", "") or ""

        final_text = (final_text or "").strip()

        # Persist assistant response
        await self.persist_assistant_message(chat_session.id, final_text)

        # Synthesize audio if requested
        audio_b64 = None
        audio_sample_rate = None
        if expect_audio and final_text:
            tts_text = sanitize_tts_text(final_text)
            candidate_text = tts_text or final_text
            audio_result = await self.synthesize_audio(candidate_text)
            if audio_result:
                audio_b64, audio_sample_rate = audio_result

        metadata.setdefault("session_id", chat_session.id)
        metadata.setdefault("session_external_id", chat_session.external_id)
        metadata.setdefault("session_title", chat_session.title)
        metadata.setdefault("enable_tools", chat_session.enable_tools)

        if transcript_info:
            metadata.setdefault("input_transcript", transcript_info)

        return ChatResponse(
            content=final_text,
            metadata=metadata,
            audio_b64=audio_b64,
            audio_sample_rate=audio_sample_rate,
            transcript=input_result.transcript,
            stt_confidence=input_result.stt_confidence,
            stt_language=input_result.stt_language,
            tool_events=tool_events,
            logs=logs,
        )

    async def send_message_streaming(
        self,
        user: Any,
        text_input: str | None = None,
        audio_b64: str | None = None,
        sample_rate: int = 16000,
        session_id: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        model: str | None = None,
        enable_tools: bool = True,
        expect_audio: bool = False,
        disable_web: bool = False,
        max_iterations: int | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Send a message and stream agent response events.

        This method orchestrates the same flow as send_message() but streams
        events in real-time. It yields raw events that should be formatted
        by the presentation layer (e.g., as SSE).

        Events yielded:
        - {"event": "tool", "data": {...}}
        - {"event": "token", "data": {"text": "..."}}
        - {"event": "log", "data": {"level": "...", "msg": "..."}}
        - {"event": "done", "data": ChatResponse}

        Args:
            user: Authenticated user object
            text_input: Optional text input
            audio_b64: Optional base64-encoded audio
            sample_rate: Audio sample rate
            session_id: Optional session identifier
            messages: Previous message history
            model: Model to use (defaults to settings)
            enable_tools: Whether to enable tool usage
            expect_audio: Whether to synthesize audio response
            max_iterations: Maximum agent iterations (defaults to settings)

        Yields:
            Event dictionaries with "event" and "data" keys

        Raises:
            ValueError: Invalid input
            RuntimeError: Processing errors
        """
        # Process input
        input_result = await self.process_text_or_audio_input(
            text_input=text_input,
            audio_b64=audio_b64,
            sample_rate=sample_rate,
        )

        transcript_info: dict[str, Any] | None = None
        if input_result.transcript:
            transcript_info = {
                "text": input_result.transcript,
                "language": input_result.stt_language,
                "confidence": input_result.stt_confidence,
            }

        # Get user ID
        user_id = get_user_id(user)

        # Determine model and iterations
        request_model = model or self.settings.chat_model
        max_iters = max_iterations or self.settings.max_agent_iterations

        # Determine external session identifier (use provided value or generate a stable UUID)
        session_identifier = str(session_id) if session_id else str(uuid4())

        # Get or create session
        chat_session = await self.get_or_create_session(
            user_id=user_id,
            external_id=session_identifier,
            model=request_model,
            enable_tools=enable_tools,
        )

        # Ensure session has a stable external identifier
        if chat_session.external_id != session_identifier:
            chat_session.external_id = session_identifier
            await self.db.flush()

        # Prepare conversation
        conversation = await self.prepare_conversation(
            messages=messages or [],
            user_message=input_result.text_content,
        )

        # Persist user message
        await self.persist_user_message(chat_session, conversation)

        if input_result.transcript:
            words = input_result.transcript.split()
            if words:
                partial = ""
                for word in words:
                    partial = f"{partial} {word}".strip()
                    yield {
                        "event": "transcript",
                        "data": {
                            "text": partial,
                            "word": word,
                            "language": input_result.stt_language,
                            "confidence": input_result.stt_confidence,
                            "partial": True,
                            "is_final": False,
                        },
                    }
                yield {
                    "event": "transcript",
                    "data": {
                        "text": input_result.transcript,
                        "language": input_result.stt_language,
                        "confidence": input_result.stt_confidence,
                        "partial": False,
                        "is_final": True,
                    },
                }
            else:
                yield {
                    "event": "transcript",
                    "data": {
                        "text": input_result.transcript,
                        "language": input_result.stt_language,
                        "confidence": input_result.stt_confidence,
                        "partial": False,
                        "is_final": True,
                    },
                }

        # Execute agent (streaming)
        collected_chunks: list[str] = []
        final_text = ""
        metadata: dict[str, Any] = {}
        tool_events: list[dict[str, Any]] = []
        logs: list[dict[str, str]] = []
        tool_recorder = ToolEventRecorder(user_id=user_id, session_id=chat_session.id)

        async for event in self.execute_agent(
            conversation=conversation,
            enable_tools=enable_tools,
            max_iterations=max_iters,
            model=request_model,
            disable_web=disable_web,
        ):
            etype = event.get("event")
            data = event.get("data", {}) or {}

            if etype == "tool":
                data = await tool_recorder.record(data)
                tool_events.append(data)
                yield {"event": "tool", "data": data}
            elif etype == "token":
                text = data.get("text", "")
                collected_chunks.append(text)
                yield {"event": "token", "data": data}
            elif etype == "log":
                log_entry = {
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", ""),
                }
                logs.append(log_entry)
                yield {"event": "log", "data": log_entry}
            elif etype == "done":
                meta = data.get("metadata", {}) or {}
                if isinstance(meta, dict):
                    metadata.update(meta)
                # Prefer final_text from done event, fallback to collected chunks
                final_text = data.get("final_text", "") or "".join(collected_chunks)
                break

        final_text = (final_text or "").strip()

        # Persist assistant response
        await self.persist_assistant_message(chat_session.id, final_text)

        # Synthesize audio if requested
        audio_b64_result = None
        audio_sample_rate_result = None
        logger.info(
            "TTS check: expect_audio=%s, final_text_length=%s",
            expect_audio,
            len(final_text) if final_text else 0,
        )
        if expect_audio and final_text:
            tts_text = sanitize_tts_text(final_text)
            candidate_text = tts_text or final_text
            logger.info("Attempting TTS synthesis for text: %s", candidate_text[:100])
            audio_result = await self.synthesize_audio(candidate_text)
            if audio_result:
                audio_b64_result, audio_sample_rate_result = audio_result
                logger.info(
                    "TTS successful: audio_b64_length=%s, sample_rate=%s",
                    len(audio_b64_result),
                    audio_sample_rate_result,
                )
            else:
                logger.warning("TTS synthesis returned None")

        # Yield final done event with complete response
        # Enrich metadata with session identifiers so the frontend can keep context in sync
        metadata.setdefault("session_id", chat_session.id)
        metadata.setdefault("session_external_id", chat_session.external_id)
        metadata.setdefault("session_title", chat_session.title)
        metadata.setdefault("enable_tools", chat_session.enable_tools)

        if transcript_info:
            metadata.setdefault("input_transcript", transcript_info)

        response = ChatResponse(
            content=final_text,
            metadata=metadata,
            audio_b64=audio_b64_result,
            audio_sample_rate=audio_sample_rate_result,
            transcript=input_result.transcript,
            stt_confidence=input_result.stt_confidence,
            stt_language=input_result.stt_language,
            tool_events=tool_events,
            logs=logs,
        )

        # Convert response to dict for JSON serialization
        yield {
            "event": "done",
            "data": {
                "content": response.content,
                "metadata": response.metadata,
                "audio_b64": response.audio_b64,
                "audio_sample_rate": response.audio_sample_rate,
                "transcript": response.transcript,
                "stt_confidence": response.stt_confidence,
                "stt_language": response.stt_language,
                "tool_events": response.tool_events,
                "logs": response.logs,
            },
        }
