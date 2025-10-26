import base64
import io
import wave
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any, AsyncIterator

import pytest
from fastapi.testclient import TestClient

from apps.api import main
from apps.api.routes.deps import get_current_user_with_collection_access


def _make_wav(duration_ms: int = 50, sample_rate: int = 16000) -> bytes:
    frame_count = int(sample_rate * (duration_ms / 1000))
    silence = b"\x00\x00" * frame_count
    with io.BytesIO() as buf:
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(silence)
        return buf.getvalue()


@pytest.fixture
def voice_client(monkeypatch: pytest.MonkeyPatch):
    # Stub database session context manager
    from unittest.mock import MagicMock, AsyncMock

    class FakeSession:
        id = 1

    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.execute = AsyncMock(return_value=AsyncMock(scalar_one_or_none=AsyncMock(return_value=None)))
    mock_session.scalar = AsyncMock(return_value=None)

    @asynccontextmanager
    async def fake_session() -> AsyncIterator[AsyncMock]:
        yield mock_session

    monkeypatch.setattr("packages.db.session.get_async_session", fake_session)
    monkeypatch.setattr("packages.db.get_async_session", fake_session)
    monkeypatch.setattr("apps.api.routes.chat.voice.get_async_session", fake_session)

    # Stub CRUD helpers
    async def noop(*args: Any, **kwargs: Any) -> None:
        return None

    async def fake_get_or_create_session(session: AsyncMock, *args: Any, **kwargs: Any) -> FakeSession:
        cs = FakeSession()
        session.add(cs)
        await session.flush()
        return cs

    monkeypatch.setattr("packages.db.crud.get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr("packages.db.crud.add_message", noop)

    async def fake_start_tool_run(*args: Any, **kwargs: Any) -> SimpleNamespace:
        return SimpleNamespace(id=1)

    monkeypatch.setattr("packages.db.crud.start_tool_run", fake_start_tool_run)
    monkeypatch.setattr("packages.db.crud.finish_tool_run", noop)

    async def fake_get_current_active_user() -> dict:
        return {"id": 1, "username": "root", "api_key": "dev-root-key", "is_root": True}

    main.app.dependency_overrides[get_current_user_with_collection_access] = lambda: {"id": 1, "username": "root", "api_key": "dev-root-key", "is_root": True}

    async def fake_ensure_root_user(*args: Any, **kwargs: Any) -> dict:
        return {"id": 1, "username": "root", "api_key": "dev-root-key", "is_root": True}

    async def fake_grant_collection_access(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr("packages.db.crud.ensure_root_user", fake_ensure_root_user)
    monkeypatch.setattr("packages.db.crud.grant_user_collection_access", fake_grant_collection_access)
    monkeypatch.setattr("apps.api.auth.security.ensure_root_user", fake_ensure_root_user)

    # Stub transcription and synthesis
    async def fake_transcribe(audio_pcm: bytes, sample_rate: int) -> dict[str, Any]:
        assert audio_pcm
        assert sample_rate == 16000
        return {"text": "ciao", "language": "it", "confidence": 0.9}

    async def fake_synthesize(text: str, *, fallback: bool = True):
        assert text
        return _make_wav(), 16000

    monkeypatch.setattr("apps.api.audio_pipeline.transcribe_audio_pcm16", fake_transcribe)
    monkeypatch.setattr("apps.api.audio_pipeline.synthesize_speech", fake_synthesize)
    monkeypatch.setattr("apps.api.routes.chat.voice.transcribe_audio_pcm16", fake_transcribe)
    monkeypatch.setattr("apps.api.routes.chat.voice.synthesize_speech", fake_synthesize)

    # Stub agent loop
    async def fake_agent_loop(**_: Any) -> AsyncIterator[dict[str, Any]]:
        yield {"event": "token", "data": {"text": "Risposta"}}
        yield {
            "event": "done",
            "data": {"metadata": {"status": "success"}, "final_text": "Risposta"},
        }

    class FakeAgentLoop:
        def __init__(self):
            self.ollama_client = Mock()
            self.registry = Mock()
            self.model = "test-model"

        async def run_until_completion(self, **kwargs: Any) -> AsyncIterator[dict[str, Any]]:
            async for event in fake_agent_loop(**kwargs):
                yield event

    from unittest.mock import Mock
    fake_agent_instance = FakeAgentLoop()
    main.app.state.agent_loop = fake_agent_instance

    original_lifespan = main.app.router.lifespan_context

    @asynccontextmanager
    async def fake_lifespan(app):
        yield

    main.app.router.lifespan_context = fake_lifespan

    with TestClient(main.app) as client:
        yield client

    # Restore globals after test
    main.app.router.lifespan_context = original_lifespan
    main.app.state.agent_loop = None  # Or original if saved
    main.app.dependency_overrides.clear()


def test_voice_turn_success(voice_client: TestClient) -> None:
    pcm = b"\x00\x00" * 160
    response = voice_client.post(
        "/v1/voice-turn",
        json={
            "messages": [],
            "audio_b64": base64.b64encode(pcm).decode("ascii"),
            "sample_rate": 16000,
            "expect_audio": True,
        },
        headers={"X-API-Key": "dev-root-key"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["transcript"] == "ciao"
    assert payload["assistant_text"] == "Risposta"
    assert payload["audio_b64"]
    assert payload["audio_sample_rate"] == 16000
