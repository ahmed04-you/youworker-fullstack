"""Integration tests for chat and voice endpoints."""

import base64
import time
import os
from typing import Iterable

import pytest
import requests

RUN_API_TESTS = os.getenv("RUN_API_TESTS") == "1"

pytestmark = pytest.mark.skipif(
    not RUN_API_TESTS,
    reason="Set RUN_API_TESTS=1 to enable integration tests against running services.",
)


@pytest.fixture
def api_base_url() -> str:
    return "http://localhost:8001"


def _iter_sse_events(response: requests.Response) -> Iterable[bytes]:
    """Yield non-empty SSE lines from a streaming response."""

    for line in response.iter_lines():
        if line:
            yield line


def test_text_mode_sse_connection(api_base_url: str) -> None:
    """Verify that the text chat endpoint streams Server-Sent Events."""

    response = requests.post(
        f"{api_base_url}/v1/chat",
        json={
            "messages": [{"role": "user", "content": "Ciao"}],
            "stream": True,
            "enable_tools": True,
        },
        headers={
            "Accept": "text/event-stream",
            "X-API-Key": "rotated-dev-root-key",
        },
        stream=True,
        timeout=30,
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    events_received = 0
    start_time = time.time()
    for line in _iter_sse_events(response):
        if line.startswith(b"event:"):
            events_received += 1
        if events_received >= 1 or (time.time() - start_time) > 5:
            break

    assert events_received >= 1, "Should receive at least one SSE event"


def test_voice_turn_rejects_invalid_audio(api_base_url: str) -> None:
    """The voice endpoint should reject payloads that are not valid base64."""

    response = requests.post(
        f"{api_base_url}/v1/voice-turn",
        json={
            "messages": [],
            "audio_b64": "$$NOT_BASE64$$",
            "sample_rate": 16000,
            "expect_audio": False,
        },
        headers={"X-API-Key": "rotated-dev-root-key"},
    )

    assert response.status_code == 400
    assert "Invalid audio" in response.text or "Invalid audio payload" in response.text


def test_voice_turn_returns_service_unavailable_without_stt(api_base_url: str) -> None:
    """When the STT model is not available, the endpoint should return 503."""

    # 20ms of silence at 16kHz => 320 samples => 640 bytes (PCM16)
    pcm_silence = b"\x00\x00" * 320
    audio_b64 = base64.b64encode(pcm_silence).decode("ascii")

    response = requests.post(
        f"{api_base_url}/v1/voice-turn",
        json={
            "messages": [],
            "audio_b64": audio_b64,
            "sample_rate": 16000,
            "expect_audio": False,
        },
        headers={"X-API-Key": "rotated-dev-root-key"},
    )

    # When faster-whisper is not installed we expect 503. If it is installed the
    # endpoint may succeed, so allow 200 as well to keep the test flexible.
    assert response.status_code in {200, 503}
    if response.status_code == 503:
        assert "STT" in response.text or "model" in response.text


def test_cors_preflight_headers(api_base_url: str) -> None:
    """Ensure that CORS preflight requests include the expected headers."""

    response = requests.options(
        f"{api_base_url}/v1/chat",
        headers={
            "Origin": "http://localhost:8000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-API-Key,Content-Type",
            "X-API-Key": "dev-root-key",
        },
    )

    assert "Access-Control-Allow-Origin" in response.headers
    assert "Access-Control-Allow-Methods" in response.headers
    assert "Access-Control-Allow-Headers" in response.headers


def test_health_endpoint_lists_voice_capabilities(api_base_url: str) -> None:
    """Health endpoint should expose voice capability flags."""

    response = requests.get(f"{api_base_url}/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] in {"healthy", "degraded"}

    components = payload.get("components", {})
    assert isinstance(components, dict)

    voice = components.get("voice", {})
    assert voice.get("mode") == "turn_based"
    assert "stt_available" in voice
    assert "tts_available" in voice

    ollama = components.get("ollama", {})
    assert "base_url" in ollama
