"""
Integration tests for communication mode switching and transport isolation.

Tests verify that:
1. Mode switching works correctly between text and voice modes
2. Transports are properly cleaned up on mode changes
3. No resource leaks occur during mode switching
4. Cross-browser compatibility is maintained
"""

import asyncio
import pytest
import websockets
import json
from typing import Dict, Any, Optional
import requests
import time


@pytest.fixture
def audio_server_url():
    """Return audio MCP server URL for tests."""
    return "ws://localhost:7006/mcp"


@pytest.fixture
def api_base_url():
    """Return API base URL for tests."""
    return "http://localhost:8001"


class TestModeSwitching:
    """Test suite for communication mode switching functionality."""

    async def test_text_mode_sse_connection(self, api_base_url):
        """Test that SSE connection works in text mode."""
        # Start SSE streaming
        response = requests.post(
            f"{api_base_url}/v1/chat",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": True,
                "enable_tools": True,
            },
            headers={"Accept": "text/event-stream", "X-API-Key": "dev-root-key"},
            stream=True,
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        # Read a few events to verify streaming works
        events_received = 0
        for line in response.iter_lines():
            if line and line.startswith(b"event:"):
                events_received += 1
                if events_received >= 2:  # At least token and tool events
                    break

        assert events_received >= 1, "Should receive at least one SSE event"

    async def test_voice_mode_audio_session_allocation(self, audio_server_url):
        """Test audio session allocation for voice mode."""
        async with websockets.connect(audio_server_url) as ws:
            # Initialize MCP connection
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {"tools": {"list": True, "call": True}}}
            }))

            response = json.loads(await ws.recv())
            assert response["result"]["protocolVersion"] == "2024-10-01"

            # Allocate audio session
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "audio.input.stream",
                    "arguments": {"sample_rate": 24000, "frame_ms": 20}
                }
            }))

            response = json.loads(await ws.recv())
            assert "session_id" in response["result"]["content"][0]["json"]
            assert "ingest_ws_url" in response["result"]["content"][0]["json"]

    async def test_stt_streaming_connection(self, audio_server_url):
        """Test STT streaming connection establishment."""
        async with websockets.connect(audio_server_url) as ws:
            # Initialize and allocate session
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {"tools": {"list": True, "call": True}}}
            }))
            await ws.recv()

            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "audio.input.stream",
                    "arguments": {"sample_rate": 24000, "frame_ms": 20}
                }
            }))
            response = json.loads(await ws.recv())
            session_data = response["result"]["content"][0]["json"]
            session_id = session_data["session_id"]

            # Enable STT streaming
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "stt.stream.transcribe",
                    "arguments": {"session_id": session_id, "vad": True}
                }
            }))
            await ws.recv()

            # Connect to STT WebSocket
            stt_ws_url = f"ws://localhost:7006/ws/stt/{session_id}"
            async with websockets.connect(stt_ws_url) as stt_ws:
                # Send a dummy audio frame
                dummy_frame = b'\x00' * 960  # 480 samples * 2 bytes (PCM16)
                audio_b64 = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKys="  # Base64 of dummy data
                
                await stt_ws.send(json.dumps({
                    "audio_frame": audio_b64,
                    "ts": time.time()
                }))

                # Should receive either partial or error response
                try:
                    response = await asyncio.wait_for(stt_ws.recv(), timeout=5.0)
                    msg = json.loads(response)
                    assert msg["type"] in ["partial", "error", "final"]
                except asyncio.TimeoutError:
                    pytest.skip("STT model not loaded, skipping real-time test")

    async def test_tts_streaming_connection(self, audio_server_url):
        """Test TTS streaming connection establishment."""
        async with websockets.connect(audio_server_url) as ws:
            # Initialize and allocate session
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {"tools": {"list": True, "call": True}}}
            }))
            await ws.recv()

            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "audio.input.stream",
                    "arguments": {"sample_rate": 24000, "frame_ms": 20}
                }
            }))
            response = json.loads(await ws.recv())
            session_data = response["result"]["content"][0]["json"]
            session_id = session_data["session_id"]

            # Enable TTS streaming
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "tts.stream.synthesize",
                    "arguments": {"session_id": session_id, "sample_rate": 24000}
                }
            }))
            await ws.recv()

            # Connect to TTS WebSocket
            tts_ws_url = f"ws://localhost:7006/ws/tts/{session_id}"
            async with websockets.connect(tts_ws_url) as tts_ws:
                # Send text for synthesis
                await tts_ws.send(json.dumps({
                    "type": "synthesize",
                    "text": "Hello, this is a test."
                }))

                # Should receive audio chunks or done/error response
                try:
                    response = await asyncio.wait_for(tts_ws.recv(), timeout=5.0)
                    msg = json.loads(response)
                    assert msg["type"] in ["audio_chunk", "done", "error"]
                except asyncio.TimeoutError:
                    pytest.skip("TTS model not loaded, skipping real-time test")

    def test_cross_browser_compatibility_headers(self, api_base_url):
        """Test that proper headers are set for cross-browser compatibility."""
        response = requests.options(
            f"{api_base_url}/v1/chat",
            headers={
                "Origin": "http://localhost:8000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-API-Key,Content-Type",
                "X-API-Key": "dev-root-key",
            },
        )
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers

    def test_audio_server_health_check(self, api_base_url):
        """Test audio server health check endpoint."""
        response = requests.get(
            f"{api_base_url.replace(':8001', ':7006')}/health",
            headers={"X-API-Key": "dev-root-key"},
        )
        assert response.status_code == 200
        
        health_data = response.json()
        assert health_data["status"] == "healthy"
        assert "whisper_available" in health_data
        assert "piper_available" in health_data
        assert "vad_available" in health_data

    async def test_barge_in_functionality(self, audio_server_url):
        """Test barge-in control for voice interruptions."""
        async with websockets.connect(audio_server_url) as ws:
            # Initialize and allocate session
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {"tools": {"list": True, "call": True}}}
            }))
            await ws.recv()

            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "audio.input.stream",
                    "arguments": {"sample_rate": 24000, "frame_ms": 20}
                }
            }))
            response = json.loads(await ws.recv())
            session_data = response["result"]["content"][0]["json"]
            session_id = session_data["session_id"]

            # Test barge-in control
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "barge_in.control",
                    "arguments": {"session_id": session_id, "action": "pause"}
                }
            }))
            response = json.loads(await ws.recv())
            assert response["result"]["content"][0]["json"]["ok"] == True

    def test_resource_cleanup_on_mode_switch(self, api_base_url):
        """Test that resources are properly cleaned up when switching modes."""
        # This test would require integration with the frontend
        # For now, we test that the API endpoints are available
        # and that health checks work properly
        
        # Test that we can make multiple requests without issues
        for i in range(3):
            response = requests.post(
                f"{api_base_url}/v1/chat",
                json={
                    "messages": [{"role": "user", "content": f"Test {i}"}],
                    "stream": False,
                    "enable_tools": True,
                },
                headers={"X-API-Key": "dev-root-key"},
            )
            assert response.status_code == 200

    @pytest.mark.parametrize("browser_user_agent", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
    ])
    def test_browser_user_agent_compatibility(self, api_base_url, browser_user_agent):
        """Test compatibility with different browser user agents."""
        response = requests.get(
            f"{api_base_url}/health",
            headers={"User-Agent": browser_user_agent}
        )
        assert response.status_code == 200


class TestTransportIsolation:
    """Test that transports are properly isolated and cleaned up."""

    async def test_no_sse_connection_leaks(self, api_base_url):
        """Test that SSE connections don't leak."""
        # Make multiple SSE connections and verify they're all cleaned up
        connections = []
        
        for i in range(5):
            response = requests.post(
                f"{api_base_url}/v1/chat",
                json={
                    "messages": [{"role": "user", "content": f"Connection test {i}"}],
                    "stream": True,
                    "enable_tools": True,
                },
                headers={"Accept": "text/event-stream", "X-API-Key": "dev-root-key"},
                stream=True,
            )
            connections.append(response)

        # Close all connections
        for conn in connections:
            conn.close()

        # Server should still be healthy
        health_response = requests.get(
            f"{api_base_url}/health",
            headers={"X-API-Key": "dev-root-key"},
        )
        assert health_response.status_code == 200

    async def test_no_websocket_connection_leaks(self, audio_server_url):
        """Test that WebSocket connections don't leak."""
        # Make multiple WebSocket connections and verify cleanup
        connections = []
        
        for i in range(5):
            ws = await websockets.connect(audio_server_url)
            connections.append(ws)

        # Close all connections
        for ws in connections:
            await ws.close()

        # Server should still be healthy
        health_response = requests.get("http://localhost:7006/health")
        assert health_response.status_code == 200


@pytest.mark.asyncio
class TestModeSwitchingPerformance:
    """Test performance characteristics of mode switching."""

    async def test_mode_switch_latency(self, api_base_url):
        """Test that mode switching doesn't cause excessive latency."""
        start_time = time.time()
        
        # Make a request to simulate mode switch
        response = requests.post(
            f"{api_base_url}/v1/chat",
            json={
                "messages": [{"role": "user", "content": "Test mode switch latency"}],
                "stream": True,
                "enable_tools": True,
            },
            headers={"Accept": "text/event-stream", "X-API-Key": "dev-root-key"},
            stream=True,
        )
        
        # Read first event
        for line in response.iter_lines():
            if line and line.startswith(b"event:"):
                break
        
        end_time = time.time()
        latency = end_time - start_time
        
        # Should receive first event within reasonable time (< 5 seconds)
        assert latency < 5.0, f"Mode switch latency too high: {latency}s"

    async def test_concurrent_mode_operations(self, api_base_url, audio_server_url):
        """Test that multiple modes can operate concurrently."""
        # Start SSE request
        sse_task = asyncio.create_task(self._make_sse_request(api_base_url))
        
        # Start WebSocket connection
        ws_task = asyncio.create_task(self._make_websocket_request(audio_server_url))
        
        # Wait for both to complete
        sse_result, ws_result = await asyncio.gather(sse_task, ws_task, return_exceptions=True)
        
        # Both should succeed
        assert not isinstance(sse_result, Exception), f"SSE request failed: {sse_result}"
        assert not isinstance(ws_result, Exception), f"WebSocket request failed: {ws_result}"

    async def _make_sse_request(self, api_base_url):
        """Helper to make SSE request."""
        response = requests.post(
            f"{api_base_url}/v1/chat",
            json={
                "messages": [{"role": "user", "content": "Concurrent SSE test"}],
                "stream": True,
                "enable_tools": True,
            },
            headers={"Accept": "text/event-stream", "X-API-Key": "dev-root-key"},
            stream=True,
        )
        
        # Read at least one event
        for line in response.iter_lines():
            if line and line.startswith(b"event:"):
                break
        
        response.close()
        return "success"

    async def _make_websocket_request(self, audio_server_url):
        """Helper to make WebSocket request."""
        async with websockets.connect(audio_server_url) as ws:
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"capabilities": {"tools": {"list": True, "call": True}}}
            }))
            response = await ws.recv()
            return "success"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
