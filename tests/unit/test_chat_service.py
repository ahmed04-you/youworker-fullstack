"""
Comprehensive unit tests for ChatService.

Tests cover:
- Input processing (text and audio)
- Session management
- Agent execution
- Audio synthesis
- Message persistence
- Error handling
"""

import base64
import pytest
from unittest.mock import Mock, AsyncMock, MagicMock
from typing import AsyncIterator, Any

from apps.api.services.chat_service import (
    ChatService,
    InputProcessingResult,
    ChatResponse,
)
from packages.llm import ChatMessage
from packages.db.models import ChatSession


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def mock_agent_loop():
    """Mock agent loop."""
    agent = AsyncMock()
    return agent


@pytest.fixture
def mock_settings():
    """Mock settings."""
    settings = Mock()
    settings.chat_model = "gpt-oss:20b"
    settings.max_agent_iterations = 10
    settings.default_model = "gpt-oss:20b"
    return settings


@pytest.fixture
def mock_user():
    """Mock user object."""
    user = Mock()
    user.id = 123
    user.username = "testuser"
    return user


@pytest.fixture
def chat_service(mock_db_session, mock_agent_loop, mock_settings):
    """Create ChatService instance with mocked dependencies."""
    return ChatService(
        db_session=mock_db_session,
        agent_loop=mock_agent_loop,
        settings=mock_settings,
    )


# ==================== Input Processing Tests ====================


@pytest.mark.asyncio
async def test_process_text_input(chat_service):
    """Test processing plain text input."""
    result = await chat_service.process_text_or_audio_input(
        text_input="Hello world",
        audio_b64=None,
    )

    assert isinstance(result, InputProcessingResult)
    assert result.text_content == "Hello world"
    assert result.transcript is None
    assert result.stt_confidence is None
    assert result.stt_language is None


@pytest.mark.asyncio
async def test_process_text_input_sanitization(chat_service, monkeypatch):
    """Test that text input is sanitized."""
    mock_sanitize = Mock(return_value="sanitized text")
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", mock_sanitize)

    result = await chat_service.process_text_or_audio_input(
        text_input="<script>alert('xss')</script>",
        audio_b64=None,
    )

    mock_sanitize.assert_called_once()
    assert result.text_content == "sanitized text"


@pytest.mark.asyncio
async def test_process_audio_input(chat_service, monkeypatch):
    """Test processing audio input."""
    # Mock transcription
    mock_transcribe = AsyncMock(return_value={
        "text": "transcribed text",
        "confidence": 0.95,
        "language": "en",
    })
    monkeypatch.setattr("apps.api.services.chat_service.transcribe_audio_pcm16", mock_transcribe)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)

    # Create valid base64 audio
    audio_data = b"fake audio data"
    audio_b64 = base64.b64encode(audio_data).decode("ascii")

    result = await chat_service.process_text_or_audio_input(
        text_input=None,
        audio_b64=audio_b64,
        sample_rate=16000,
    )

    assert result.text_content == "transcribed text"
    assert result.transcript == "transcribed text"
    assert result.stt_confidence == 0.95
    assert result.stt_language == "en"
    mock_transcribe.assert_called_once_with(audio_data, 16000)


@pytest.mark.asyncio
async def test_process_invalid_base64_audio(chat_service):
    """Test handling of invalid base64 audio."""
    with pytest.raises(ValueError, match="Invalid base64 audio payload"):
        await chat_service.process_text_or_audio_input(
            text_input=None,
            audio_b64="not-valid-base64!!!",
        )


@pytest.mark.asyncio
async def test_process_transcription_failure(chat_service, monkeypatch):
    """Test handling of transcription failure."""
    mock_transcribe = AsyncMock(side_effect=RuntimeError("Transcription service down"))
    monkeypatch.setattr("apps.api.services.chat_service.transcribe_audio_pcm16", mock_transcribe)

    audio_b64 = base64.b64encode(b"audio").decode("ascii")

    with pytest.raises(RuntimeError, match="Transcription service unavailable"):
        await chat_service.process_text_or_audio_input(
            text_input=None,
            audio_b64=audio_b64,
        )


@pytest.mark.asyncio
async def test_process_empty_transcription(chat_service, monkeypatch):
    """Test handling of empty transcription result."""
    mock_transcribe = AsyncMock(return_value={"text": "   ", "confidence": 0.0})
    monkeypatch.setattr("apps.api.services.chat_service.transcribe_audio_pcm16", mock_transcribe)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x.strip())

    audio_b64 = base64.b64encode(b"audio").decode("ascii")

    with pytest.raises(ValueError, match="Transcription produced empty text"):
        await chat_service.process_text_or_audio_input(
            text_input=None,
            audio_b64=audio_b64,
        )


@pytest.mark.asyncio
async def test_process_no_input_provided(chat_service):
    """Test error when neither text nor audio provided."""
    with pytest.raises(ValueError, match="Either text_input or audio_b64 must be provided"):
        await chat_service.process_text_or_audio_input(
            text_input=None,
            audio_b64=None,
        )


@pytest.mark.asyncio
async def test_process_empty_text_input(chat_service):
    """Test error when text input is empty/whitespace."""
    with pytest.raises(ValueError, match="Either text_input or audio_b64 must be provided"):
        await chat_service.process_text_or_audio_input(
            text_input="   ",
            audio_b64=None,
        )


# ==================== Session Management Tests ====================


@pytest.mark.asyncio
async def test_get_or_create_session(chat_service, monkeypatch):
    """Test session creation/retrieval."""
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 456
    mock_get_or_create = AsyncMock(return_value=mock_session)
    monkeypatch.setattr(
        "apps.api.services.chat_service.get_or_create_chat_session",
        mock_get_or_create,
    )

    result = await chat_service.get_or_create_session(
        user_id=123,
        external_id="test-session",
        model="gpt-oss:20b",
        enable_tools=True,
    )

    assert result == mock_session
    mock_get_or_create.assert_called_once_with(
        chat_service.db,
        user_id=123,
        external_id="test-session",
        model="gpt-oss:20b",
        enable_tools=True,
    )


# ==================== Conversation Preparation Tests ====================


@pytest.mark.asyncio
async def test_prepare_conversation(chat_service, monkeypatch):
    """Test conversation preparation."""
    # Mock prepare_chat_messages
    existing_messages = [
        {"role": "user", "content": "Previous message"},
        {"role": "assistant", "content": "Previous response"},
    ]
    prepared = [
        ChatMessage(role="user", content="Previous message"),
        ChatMessage(role="assistant", content="Previous response"),
    ]
    mock_prepare = AsyncMock(return_value=prepared)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)

    result = await chat_service.prepare_conversation(
        messages=existing_messages,
        user_message="New message",
    )

    assert len(result) == 3
    assert result[-1].role == "user"
    assert result[-1].content == "New message"
    mock_prepare.assert_called_once_with(existing_messages)


# ==================== Agent Execution Tests ====================


@pytest.mark.asyncio
async def test_execute_agent(chat_service, mock_agent_loop):
    """Test agent execution."""
    # Setup mock agent response
    async def mock_run():
        yield {"event": "token", "data": {"text": "Hello"}}
        yield {"event": "token", "data": {"text": " world"}}
        yield {"event": "done", "data": {"metadata": {}}}

    mock_agent_loop.run_until_completion = Mock(return_value=mock_run())

    conversation = [ChatMessage(role="user", content="Test")]
    events = []

    async for event in chat_service.execute_agent(
        conversation=conversation,
        enable_tools=True,
        max_iterations=10,
        model="gpt-oss:20b",
    ):
        events.append(event)

    assert len(events) == 3
    assert events[0]["event"] == "token"
    assert events[1]["event"] == "token"
    assert events[2]["event"] == "done"


# ==================== Audio Synthesis Tests ====================


@pytest.mark.asyncio
async def test_synthesize_audio_success(chat_service, monkeypatch):
    """Test successful audio synthesis."""
    mock_wav = b"fake wav data"
    mock_synthesize = AsyncMock(return_value=(mock_wav, 16000))
    monkeypatch.setattr("apps.api.services.chat_service.synthesize_speech", mock_synthesize)

    result = await chat_service.synthesize_audio("Hello world", fallback=True)

    assert result is not None
    audio_b64, sample_rate = result
    assert base64.b64decode(audio_b64) == mock_wav
    assert sample_rate == 16000
    mock_synthesize.assert_called_once_with("Hello world", fallback=True)


@pytest.mark.asyncio
async def test_synthesize_audio_empty_text(chat_service):
    """Test audio synthesis with empty text."""
    result = await chat_service.synthesize_audio("", fallback=True)
    assert result is None


@pytest.mark.asyncio
async def test_synthesize_audio_failure(chat_service, monkeypatch):
    """Test audio synthesis failure handling."""
    mock_synthesize = AsyncMock(side_effect=Exception("TTS service error"))
    monkeypatch.setattr("apps.api.services.chat_service.synthesize_speech", mock_synthesize)

    result = await chat_service.synthesize_audio("Hello", fallback=True)
    assert result is None  # Should return None on failure, not raise


@pytest.mark.asyncio
async def test_synthesize_audio_returns_none(chat_service, monkeypatch):
    """Test audio synthesis when service returns None."""
    mock_synthesize = AsyncMock(return_value=None)
    monkeypatch.setattr("apps.api.services.chat_service.synthesize_speech", mock_synthesize)

    result = await chat_service.synthesize_audio("Hello", fallback=True)
    assert result is None


# ==================== Message Persistence Tests ====================


@pytest.mark.asyncio
async def test_persist_user_message(chat_service, monkeypatch):
    """Test user message persistence."""
    mock_session = Mock(spec=ChatSession)
    mock_persist = AsyncMock()
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist)

    conversation = [ChatMessage(role="user", content="Test")]
    await chat_service.persist_user_message(mock_session, conversation)

    mock_persist.assert_called_once_with(chat_service.db, mock_session, conversation)


@pytest.mark.asyncio
async def test_persist_assistant_message(chat_service, monkeypatch):
    """Test assistant message persistence."""
    mock_persist = AsyncMock()
    monkeypatch.setattr(
        "apps.api.services.chat_service.persist_final_assistant_message",
        mock_persist,
    )

    await chat_service.persist_assistant_message(456, "Test response")

    mock_persist.assert_called_once_with(chat_service.db, 456, "Test response")


@pytest.mark.asyncio
async def test_persist_assistant_message_empty(chat_service, monkeypatch):
    """Test that empty assistant messages are not persisted."""
    mock_persist = AsyncMock()
    monkeypatch.setattr(
        "apps.api.services.chat_service.persist_final_assistant_message",
        mock_persist,
    )

    await chat_service.persist_assistant_message(456, "")
    mock_persist.assert_not_called()


# ==================== Integration: send_message Tests ====================


@pytest.mark.asyncio
async def test_send_message_text_only(chat_service, mock_user, monkeypatch):
    """Test send_message with text input only."""
    # Mock all dependencies
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="Hello")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response
    async def mock_agent_run(*args, **kwargs):
        yield {"event": "token", "data": {"text": "Hello "}}
        yield {"event": "token", "data": {"text": "there"}}
        yield {"event": "done", "data": {"metadata": {"status": "ok"}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute
    response = await chat_service.send_message(
        user=mock_user,
        text_input="Hello",
        session_id="test-session",
    )

    # Verify
    assert isinstance(response, ChatResponse)
    assert response.content == "Hello there"
    assert response.metadata == {"status": "ok"}
    assert response.audio_b64 is None
    assert response.transcript is None
    mock_persist_assistant.assert_called_once_with(mock_session.id, "Hello there")


@pytest.mark.asyncio
async def test_send_message_with_audio_input(chat_service, mock_user, monkeypatch):
    """Test send_message with audio input."""
    # Mock dependencies
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_transcribe = AsyncMock(return_value={
        "text": "transcribed",
        "confidence": 0.9,
        "language": "en",
    })
    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="transcribed")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.transcribe_audio_pcm16", mock_transcribe)
    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response
    async def mock_agent_run(*args, **kwargs):
        yield {"event": "done", "data": {"final_text": "Response", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute
    audio_b64 = base64.b64encode(b"audio").decode("ascii")
    response = await chat_service.send_message(
        user=mock_user,
        audio_b64=audio_b64,
        session_id="test-session",
    )

    # Verify
    assert response.content == "Response"
    assert response.transcript == "transcribed"
    assert response.stt_confidence == 0.9
    assert response.stt_language == "en"


@pytest.mark.asyncio
async def test_send_message_with_audio_output(chat_service, mock_user, monkeypatch):
    """Test send_message with audio synthesis."""
    # Mock dependencies
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="Hello")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()
    mock_synthesize = AsyncMock(return_value=(b"wav", 16000))

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.synthesize_speech", mock_synthesize)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response
    async def mock_agent_run(*args, **kwargs):
        yield {"event": "done", "data": {"final_text": "Audio response", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute with expect_audio=True
    response = await chat_service.send_message(
        user=mock_user,
        text_input="Hello",
        session_id="test-session",
        expect_audio=True,
    )

    # Verify
    assert response.content == "Audio response"
    assert response.audio_b64 is not None
    assert response.audio_sample_rate == 16000
    mock_synthesize.assert_called_once_with("Audio response", fallback=True)


@pytest.mark.asyncio
async def test_send_message_with_tool_events(chat_service, mock_user, monkeypatch):
    """Test send_message with tool calls."""
    # Mock dependencies
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="search")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    # Mock ToolEventRecorder
    class MockToolRecorder:
        def __init__(self, user_id, session_id):
            self.user_id = user_id
            self.session_id = session_id

        async def record(self, data):
            data["recorded"] = True
            return data

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)
    monkeypatch.setattr("apps.api.services.chat_service.ToolEventRecorder", MockToolRecorder)

    # Mock agent response with tool calls
    async def mock_agent_run(*args, **kwargs):
        yield {"event": "tool", "data": {"tool": "search", "args": {}}}
        yield {"event": "token", "data": {"text": "Results"}}
        yield {"event": "done", "data": {"metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute
    response = await chat_service.send_message(
        user=mock_user,
        text_input="search something",
        session_id="test-session",
    )

    # Verify tool events were recorded
    assert len(response.tool_events) == 1
    assert response.tool_events[0]["recorded"] is True


@pytest.mark.asyncio
async def test_send_message_with_logs(chat_service, mock_user, monkeypatch):
    """Test send_message captures log events."""
    # Mock dependencies
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="test")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response with logs
    async def mock_agent_run(*args, **kwargs):
        yield {"event": "log", "data": {"level": "info", "msg": "Processing"}}
        yield {"event": "log", "data": {"level": "debug", "msg": "Details"}}
        yield {"event": "done", "data": {"final_text": "Done", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute
    response = await chat_service.send_message(
        user=mock_user,
        text_input="test",
        session_id="test-session",
    )

    # Verify logs were captured
    assert len(response.logs) == 2
    assert response.logs[0]["level"] == "info"
    assert response.logs[0]["msg"] == "Processing"
    assert response.logs[1]["level"] == "debug"


@pytest.mark.asyncio
async def test_send_message_custom_model(chat_service, mock_user, monkeypatch):
    """Test send_message with custom model."""
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="test")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response
    async def mock_agent_run(*args, **kwargs):
        # Verify model was passed correctly
        assert kwargs.get("model") == "custom-model"
        yield {"event": "done", "data": {"final_text": "Done", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute with custom model
    response = await chat_service.send_message(
        user=mock_user,
        text_input="test",
        model="custom-model",
    )

    assert response.content == "Done"


@pytest.mark.asyncio
async def test_send_message_custom_max_iterations(chat_service, mock_user, monkeypatch):
    """Test send_message with custom max_iterations."""
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="test")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    # Mock agent response
    async def mock_agent_run(*args, **kwargs):
        # Verify max_iterations was passed correctly
        assert kwargs.get("max_iterations") == 20
        yield {"event": "done", "data": {"final_text": "Done", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute with custom max_iterations
    response = await chat_service.send_message(
        user=mock_user,
        text_input="test",
        max_iterations=20,
    )

    assert response.content == "Done"


@pytest.mark.asyncio
async def test_send_message_default_session_id(chat_service, mock_user, monkeypatch):
    """Test send_message uses 'default' session_id when not provided."""
    mock_session = Mock(spec=ChatSession)
    mock_session.id = 789

    mock_get_session = AsyncMock(return_value=mock_session)
    mock_prepare = AsyncMock(return_value=[ChatMessage(role="user", content="test")])
    mock_persist_user = AsyncMock()
    mock_persist_assistant = AsyncMock()

    monkeypatch.setattr("apps.api.services.chat_service.get_or_create_chat_session", mock_get_session)
    monkeypatch.setattr("apps.api.services.chat_service.prepare_chat_messages", mock_prepare)
    monkeypatch.setattr("apps.api.services.chat_service.persist_last_user_message", mock_persist_user)
    monkeypatch.setattr("apps.api.services.chat_service.persist_final_assistant_message", mock_persist_assistant)
    monkeypatch.setattr("apps.api.services.chat_service.sanitize_input", lambda x: x)
    monkeypatch.setattr("apps.api.services.chat_service.get_user_id", lambda x: x.id)

    async def mock_agent_run(*args, **kwargs):
        yield {"event": "done", "data": {"final_text": "Done", "metadata": {}}}

    chat_service.agent_loop.run_until_completion = Mock(return_value=mock_agent_run())

    # Execute without session_id
    await chat_service.send_message(user=mock_user, text_input="test")

    # Verify default session_id was used
    mock_get_session.assert_called_once()
    args, kwargs = mock_get_session.call_args
    assert kwargs["external_id"] == "default"
