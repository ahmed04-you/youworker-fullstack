import base64
import io
import wave
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any, AsyncIterator

import pytest
from fastapi.testclient import TestClient

from apps.api import main


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
def voice_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Stub database session context manager
    @asynccontextmanager
    async def fake_session() -> AsyncIterator[None]:
        yield None

    monkeypatch.setattr(main, "get_async_session", fake_session)

    # Stub CRUD helpers
    async def noop(*args: Any, **kwargs: Any) -> None:
        return None

    class FakeSession:
        id = 1

    async def fake_get_or_create_session(*args: Any, **kwargs: Any) -> FakeSession:
        return FakeSession()

    monkeypatch.setattr("packages.db.crud.get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr("packages.db.crud.add_message", noop)

    async def fake_start_tool_run(*args: Any, **kwargs: Any) -> SimpleNamespace:
        return SimpleNamespace(id=1)

    monkeypatch.setattr("packages.db.crud.start_tool_run", fake_start_tool_run)
    monkeypatch.setattr("packages.db.crud.finish_tool_run", noop)

    # Stub transcription and synthesis
    async def fake_transcribe(audio_pcm: bytes, sample_rate: int) -> dict[str, Any]:
        assert audio_pcm
        assert sample_rate == 16000
        return {"text": "ciao", "language": "it", "confidence": 0.9}

    async def fake_synthesize(text: str, *, fallback: bool = True):
        assert text
        return _make_wav(), 16000

    original_transcribe = main.transcribe_audio_pcm16
    original_synthesize = main.synthesize_speech
    monkeypatch.setattr(main, "transcribe_audio_pcm16", fake_transcribe)
    monkeypatch.setattr(main, "synthesize_speech", fake_synthesize)

    # Stub agent loop
    async def fake_agent_loop(**_: Any) -> AsyncIterator[dict[str, Any]]:
        yield {"event": "token", "data": {"text": "Risposta"}}
        yield {
            "event": "done",
            "data": {"metadata": {"status": "success"}, "final_text": "Risposta"},
        }

    class FakeAgentLoop:
        model = "test-model"

        async def run_until_completion(self, **kwargs: Any) -> AsyncIterator[dict[str, Any]]:
            async for event in fake_agent_loop(**kwargs):
                yield event

    original_agent_loop = main.agent_loop
    main.agent_loop = FakeAgentLoop()

    with TestClient(main.app, lifespan="off") as client:
        yield client

    # Restore globals after test
    main.agent_loop = original_agent_loop
    main.transcribe_audio_pcm16 = original_transcribe
    main.synthesize_speech = original_synthesize


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
