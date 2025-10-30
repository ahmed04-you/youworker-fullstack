"""
Unified chat endpoint with WebSocket support for real-time communication.

WebSocket Reconnection Strategy for Frontend Clients
=====================================================

This document describes the recommended reconnection strategy for WebSocket clients
connecting to the /chat/{session_id} endpoint.

## Connection Lifecycle

1. **Initial Connection**
   - Connect to ws://host/chat/{session_id}
   - Include authentication via one of:
     - Header: X-Api-Key: <your_api_key>
     - Query param: ?api_key=<your_api_key>
     - Header: Authorization: <your_api_key> (backward compat)

2. **Heartbeat/Keep-Alive**
   - Server sends periodic heartbeat messages (every 30 seconds by default)
   - Client should respond to heartbeats to keep connection alive
   - If no heartbeat received for 60 seconds, consider connection dead

3. **Disconnection Detection**
   - Listen for WebSocket close events (onclose)
   - Listen for WebSocket error events (onerror)
   - Detect network failures (no heartbeat)

## Recommended Reconnection Algorithm

### Exponential Backoff with Jitter

```typescript
interface ReconnectionConfig {
  maxRetries: number;        // Maximum reconnection attempts (default: 10)
  initialDelay: number;      // Initial delay in ms (default: 1000)
  maxDelay: number;          // Maximum delay in ms (default: 30000)
  backoffMultiplier: number; // Delay multiplier (default: 2)
  jitterFactor: number;      // Random jitter 0-1 (default: 0.1)
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private config: ReconnectionConfig = {
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  };

  connect(sessionId: string, apiKey: string) {
    const url = `ws://localhost:8000/chat/${sessionId}?api_key=${apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0; // Reset on successful connection
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (event.code !== 1000) { // 1000 = normal closure
        this.scheduleReconnect(sessionId, apiKey);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Error will trigger onclose, which handles reconnection
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };
  }

  private scheduleReconnect(sessionId: string, apiKey: string) {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      console.error('Max reconnection attempts reached');
      this.onMaxRetriesReached?.();
      return;
    }

    const delay = this.calculateDelay();
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.config.maxRetries})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(sessionId, apiKey);
    }, delay);
  }

  private calculateDelay(): number {
    // Exponential backoff: delay = initialDelay * (multiplier ^ attempts)
    const exponentialDelay = this.config.initialDelay *
      Math.pow(this.config.backoffMultiplier, this.reconnectAttempts);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add random jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() - 0.5);

    return Math.floor(cappedDelay + jitter);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: WebSocket not open');
    }
  }

  // Callback for max retries reached
  onMaxRetriesReached?: () => void;

  private handleMessage(data: any) {
    // Handle different message types
    switch (data.type) {
      case 'heartbeat':
        // Respond to server heartbeat
        this.send({ type: 'heartbeat_ack' });
        break;
      case 'text':
      case 'audio':
      case 'tool':
      case 'status':
        // Handle actual messages
        this.onMessage?.( data);
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  // Callback for messages
  onMessage?: (data: any) => void;
}
```

## Usage Example

```typescript
const client = new WebSocketClient();

// Set up callbacks
client.onMessage = (data) => {
  console.log('Received:', data);
  // Update UI with message
};

client.onMaxRetriesReached = () => {
  // Show error to user
  alert('Connection lost. Please refresh the page.');
};

// Connect
client.connect('my-session-id', 'my-api-key');

// Send message
client.send({
  type: 'text',
  content: 'Hello, AI!',
  metadata: {}
});

// Disconnect when done
client.disconnect();
```

## Best Practices

1. **Session State Management**
   - Store session_id in browser storage for reconnection
   - Maintain message queue for failed sends during reconnection
   - Re-send pending messages after successful reconnection

2. **User Experience**
   - Show connection status indicator in UI
   - Display "Reconnecting..." message during reconnection
   - Allow manual reconnection button after max retries

3. **Error Handling**
   - Distinguish between network errors and server errors
   - Log disconnection reasons for debugging
   - Provide clear error messages to users

4. **Security**
   - Don't expose API keys in URLs for production (use headers)
   - Implement token refresh if using JWT authentication
   - Clear sensitive data on disconnect

5. **Performance**
   - Avoid creating multiple concurrent connections
   - Clean up event listeners on disconnect
   - Use connection pooling for multiple sessions
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from apps.api.routes.deps import get_current_user_with_collection_access
from apps.api.routes.deps import get_agent_loop
from apps.api.websocket_manager import get_connection_manager
from apps.api.audio_pipeline import (
    transcribe_audio_pcm16,
    synthesize_speech,
)
from packages.agent import AgentLoop
from packages.db import get_async_session
from packages.db.models import User
from packages.llm import ChatMessage as LLMChatMessage

from apps.api.routes.chat.models import UnifiedChatRequest, UnifiedChatResponse
from apps.api.routes.chat.helpers import prepare_chat_messages
from apps.api.routes.chat.persistence import (
    persist_last_user_message,
    record_tool_start,
    record_tool_end,
    persist_final_assistant_message,
    get_or_create_chat_session,
)

logger = logging.getLogger(__name__)

router = APIRouter()
manager = get_connection_manager()


class ChatMessageModel(BaseModel):
    """Enhanced chat message model for chat API."""

    type: str  # "text", "audio", "system"
    content: str | None = None
    audio_data: str | None = None  # Base64 encoded audio
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | None = None


class ChatResponseModel(BaseModel):
    """Enhanced chat response model for chat API."""

    type: str  # "text", "audio", "error", "tool", "status"
    content: str | None = None
    audio_data: str | None = None
    sample_rate: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | None = None


@router.websocket("/chat/{session_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    session_id: str,
):
    """
    WebSocket endpoint for real-time chat communication.

    Handles:
    - Text and audio messages
    - Real-time streaming responses
    - Tool execution with progress updates
    - Audio streaming for TTS
    """
    # Authenticate user via API key (single root user)
    user = None
    auth_error = None

    try:
        # Extract API key from headers or query params
        api_key = websocket.headers.get("x-api-key")
        if not api_key:
            api_key = websocket.query_params.get("api_key")

        if not api_key:
            # Also check Authorization header for API key (backward compat)
            auth_header = websocket.headers.get("authorization")
            if auth_header and not auth_header.startswith("Bearer "):
                api_key = auth_header.strip()

        if not api_key:
            raise ValueError("API key required")

        # Validate API key (ties to root user)
        from apps.api.auth.security import verify_api_key

        if not await verify_api_key(api_key):
            raise ValueError("Invalid API key")

        # Tie to root user (single user for now)
        async with get_async_session() as db:
            from packages.db.crud import ensure_root_user

            user = await ensure_root_user(db, username="root", api_key=api_key)
            if not user:
                raise ValueError("User not found for API key")

    except Exception as e:
        logger.error("WebSocket auth error", extra={"error": str(e), "error_type": type(e).__name__})
        auth_error = str(e)

    # Accept connection (we'll handle auth errors after accepting)
    await websocket.accept()

    if auth_error or not user:
        error_msg = auth_error or "Authentication required"
        await websocket.send_json(
            {
                "type": "error",
                "content": error_msg,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        await websocket.close(code=1008, reason=error_msg)
        return

    # Register connection (tie to user from API key)
    connection_id = await manager.connect(websocket, user.id, session_id)

    try:
        # Send welcome message
        await manager.send_message(
            connection_id,
            {
                "type": "system",
                "content": "Connected to chat session",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Handle messages
        while True:
            try:
                # Receive message
                data = await websocket.receive_text()
                message = ChatMessageModel.model_validate_json(data)

                # Process message based on type
                if message.type == "text":
                    await handle_text_message(connection_id, message, user, session_id)
                elif message.type == "audio":
                    await handle_audio_message(connection_id, message, user, session_id)
                elif message.type == "stop":
                    # Handle stop streaming request
                    logger.info("Stop request received", extra={"connection_id": connection_id})
                    # Cancel any ongoing tasks for this connection
                    # In a production system, you would track and cancel the async task
                    await manager.send_message(
                        connection_id,
                        {
                            "type": "status",
                            "content": "Stream stopped",
                            "metadata": {"stage": "stopped"},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                elif message.type == "ping":
                    # Handle heartbeat
                    await manager.update_heartbeat(connection_id)
                    await manager.send_message(
                        connection_id,
                        {
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                else:
                    logger.warning("Unknown message type", extra={"message_type": message.type})

            except WebSocketDisconnect:
                logger.info("WebSocket disconnected", extra={"connection_id": connection_id})
                break
            except Exception as e:
                logger.error("Error processing message", extra={"error": str(e), "error_type": type(e).__name__})
                await manager.send_message(
                    connection_id,
                    {
                        "type": "error",
                        "content": f"Error processing message: {str(e)}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

    except Exception as e:
        logger.error("WebSocket error", extra={"error": str(e), "error_type": type(e).__name__})
    finally:
        await manager.disconnect(connection_id)


async def handle_text_message(
    connection_id: str,
    message: ChatMessageModel,
    user: User,
    session_id: str,
):
    """Handle text message and stream response."""
    if not message.content:
        return

    # Get agent loop from app state via DI-like access
    from apps.api.main import app

    agent_loop = app.state.agent_loop

    if not agent_loop:
        logger.error("Agent loop not initialized")
        await manager.send_message(
            connection_id,
            {
                "type": "error",
                "content": "Service not ready - agent loop not initialized",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return

    # Prepare conversation
    async with get_async_session() as db:
        chat_session = await get_or_create_chat_session(
            db,
            user_id=user.id,
            external_id=session_id,
            model="gpt-oss:20b",
            enable_tools=True,
        )

        # Get conversation history
        conversation = await prepare_chat_messages([])  # Load from session in real implementation
        conversation.append(LLMChatMessage(role="user", content=message.content))

        # Persist user message
        await persist_last_user_message(db, chat_session, conversation)

    # Stream response
    await stream_agent_response(
        connection_id,
        conversation,
        user.id,
        session_id,
        agent_loop,
        chat_session,
        expect_audio=message.metadata.get("expect_audio", False),
    )


async def handle_audio_message(
    connection_id: str,
    message: ChatMessageModel,
    user,
    session_id: str,
):
    """Handle audio message with transcription and response."""
    if not message.audio_data:
        return

    try:
        # Decode audio
        audio_bytes = base64.b64decode(message.audio_data)

        # Send transcription status
        await manager.send_message(
            connection_id,
            {
                "type": "status",
                "content": "Transcribing audio...",
                "metadata": {"stage": "transcription"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Transcribe audio
        transcript_result = await transcribe_audio_pcm16(
            audio_bytes,
            message.sample_rate,
        )

        transcript = transcript_result.get("text", "").strip()
        if not transcript:
            await manager.send_message(
                connection_id,
                {
                    "type": "error",
                    "content": "Could not transcribe audio",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return

        # Send transcript
        await manager.send_message(
            connection_id,
            {
                "type": "transcript",
                "content": transcript,
                "metadata": {
                    "confidence": transcript_result.get("confidence"),
                    "language": transcript_result.get("language"),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Process as text message
        text_message = ChatMessageModel(
            type="text",
            content=transcript,
            metadata=message.metadata,
        )
        await handle_text_message(connection_id, text_message, user, session_id)

    except Exception as e:
        logger.error("Error processing audio", extra={"error": str(e), "error_type": type(e).__name__})
        await manager.send_message(
            connection_id,
            {
                "type": "error",
                "content": f"Error processing audio: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


async def stream_agent_response(
    connection_id: str,
    conversation: list[LLMChatMessage],
    user_id: int,
    session_id: str,
    agent_loop: AgentLoop,
    chat_session,
    expect_audio: bool = False,
):
    """Stream agent response with real-time updates."""

    # Send thinking status
    await manager.send_message(
        connection_id,
        {
            "type": "status",
            "content": "Thinking...",
            "metadata": {"stage": "thinking"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    collected_text = ""
    tool_events = []

    try:
        # Stream agent response
        async for event in agent_loop.run_until_completion(
            messages=conversation,
            enable_tools=True,
            max_iterations=10,
            language="it",
            model="gpt-oss:20b",
        ):
            event_type = event.get("event")
            data = event.get("data", {})

            if event_type == "token":
                # Stream text token
                text = data.get("text", "")
                collected_text += text

                await manager.send_message(
                    connection_id,
                    {
                        "type": "text",
                        "content": text,
                        "metadata": {"is_streaming": True},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

            elif event_type == "tool":
                # Handle tool event
                tool_events.append(data)

                await manager.send_message(
                    connection_id,
                    {
                        "type": "tool",
                        "content": data.get("tool", ""),
                        "metadata": {
                            "status": data.get("status"),
                            "args": data.get("args"),
                            "latency_ms": data.get("latency_ms"),
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

                # Record tool execution in database
                if data.get("status") == "start":
                    async with get_async_session() as db:
                        tool_run = await record_tool_start(
                            db,
                            user_id=user_id,
                            session_id=None,  # Will be updated with actual session ID
                            message_id=None,  # TODO: Thread message context through agent loop
                            tool_name=data.get("tool"),
                            args=data.get("args"),
                            start_ts=datetime.now(timezone.utc),
                        )
                elif data.get("status") in ["end", "error"]:
                    async with get_async_session() as db:
                        await record_tool_end(
                            db,
                            run_id=(
                                tool_run.id if tool_run else 1
                            ),  # Get from start event in real implementation
                            status=data.get("status"),
                            end_ts=datetime.now(timezone.utc),
                            latency_ms=data.get("latency_ms"),
                            result_preview=data.get("result_preview"),
                            tool_name=data.get("tool"),
                        )

            elif event_type == "done":
                # Final response
                final_text = data.get("final_text", collected_text)

                # Persist final message
                async with get_async_session() as db:
                    await persist_final_assistant_message(
                        db,
                        chat_session.id,  # Use the actual session ID
                        final_text,
                    )

                # Send final text
                await manager.send_message(
                    connection_id,
                    {
                        "type": "text",
                        "content": final_text,
                        "metadata": {"is_final": True},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

                # Generate audio if requested
                if expect_audio and final_text:
                    await stream_audio_response(connection_id, final_text)

                # Send completion status
                await manager.send_message(
                    connection_id,
                    {
                        "type": "status",
                        "content": "Response complete",
                        "metadata": {"stage": "complete"},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

                break

    except Exception as e:
        logger.error("Error in agent response", extra={"error": str(e), "error_type": type(e).__name__})
        await manager.send_message(
            connection_id,
            {
                "type": "error",
                "content": f"Error generating response: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


async def stream_audio_response(connection_id: str, text: str):
    """Stream audio response for TTS."""
    try:
        # Send audio generation status
        await manager.send_message(
            connection_id,
            {
                "type": "status",
                "content": "Generating audio...",
                "metadata": {"stage": "audio_generation"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Generate audio (non-streaming for now)
        audio_result = await synthesize_speech(text, fallback=True)
        if audio_result:
            wav_bytes, sample_rate = audio_result
            # Encode as base64
            audio_b64 = base64.b64encode(wav_bytes).decode("ascii")

            # Send audio
            await manager.send_message(
                connection_id,
                {
                    "type": "audio",
                    "audio_data": audio_b64,
                    "sample_rate": sample_rate,
                    "metadata": {"is_final": True},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

        # Send audio completion
        await manager.send_message(
            connection_id,
            {
                "type": "audio",
                "metadata": {"is_final": True},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    except Exception as e:
        logger.error("Error generating audio", extra={"error": str(e), "error_type": type(e).__name__})
        await manager.send_message(
            connection_id,
            {
                "type": "error",
                "content": f"Error generating audio: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


@router.post("/chat", response_model=UnifiedChatResponse)
async def unified_chat_endpoint(
    request: UnifiedChatRequest,
    current_user=Depends(get_current_user_with_collection_access),
    agent_loop: AgentLoop = Depends(get_agent_loop),
):
    """
    Fallback HTTP endpoint for unified chat (non-WebSocket).

    Maintains compatibility with existing clients while WebSocket is preferred.
    """
    # Process input (text or audio)
    text_content = None
    transcript = None
    stt_confidence = None
    stt_language = None

    if request.text_input and request.text_input.strip():
        text_content = request.text_input.strip()
    elif request.audio_b64:
        try:
            audio_bytes = base64.b64decode(request.audio_b64)
            stt_result = await transcribe_audio_pcm16(audio_bytes, request.sample_rate)
            text_content = stt_result.get("text", "").strip()
            transcript = text_content
            stt_confidence = stt_result.get("confidence")
            stt_language = stt_result.get("language")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    else:
        raise HTTPException(
            status_code=400, detail="Either text_input or audio_b64 must be provided"
        )

    if not text_content:
        raise HTTPException(status_code=400, detail="No content to process")

    # Build conversation
    conversation = await prepare_chat_messages(request.messages or [])
    conversation.append(LLMChatMessage(role="user", content=text_content))

    request_model = request.model or "gpt-oss:20b"

    # Create/get session
    async with get_async_session() as db:
        chat_session = await get_or_create_chat_session(
            db,
            user_id=current_user.id,
            external_id=request.session_id or "default",
            model=request_model,
            enable_tools=request.enable_tools,
        )
        chat_session_id = chat_session.id
        await persist_last_user_message(db, chat_session, conversation)

    # Process with agent
    final_text = ""
    metadata = {}
    tool_events = []

    async for event in agent_loop.run_until_completion(
        messages=conversation,
        enable_tools=request.enable_tools,
        max_iterations=10,
        model=request_model,
    ):
        event_type = event.get("event")
        data = event.get("data", {})

        if event_type == "token":
            final_text += data.get("text", "")
        elif event_type == "tool":
            tool_events.append(data)
        elif event_type == "done":
            final_text = data.get("final_text", final_text)
            meta = data.get("metadata", {})
            if isinstance(meta, dict):
                metadata.update(meta)

    # Persist final message
    if final_text:
        async with get_async_session() as db:
            await persist_final_assistant_message(db, chat_session_id, final_text)

    # Generate audio if requested
    audio_b64 = None
    audio_sample_rate = None
    if request.expect_audio and final_text:
        try:
            synth_result = await synthesize_speech(final_text, fallback=True)
            if synth_result:
                wav_bytes, sr = synth_result
                audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
                audio_sample_rate = sr
        except Exception as e:
            logger.error("Voice synthesis failed", extra={"error": str(e), "error_type": type(e).__name__})

    return UnifiedChatResponse(
        content=final_text,
        transcript=transcript,
        metadata=metadata,
        audio_b64=audio_b64,
        audio_sample_rate=audio_sample_rate,
        stt_confidence=stt_confidence,
        stt_language=stt_language,
        tool_events=tool_events,
    )


@router.get("/chat/", include_in_schema=False)
@router.get("/chat", include_in_schema=False)
async def chat_health_check():
    """Health check endpoint for chat service."""
    return {"status": "ok", "message": "Chat service is ready"}


@router.get("/chat/test")
async def websocket_test_page():
    """Simple test page for WebSocket connection."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Chat Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            #messages { border: 1px solid #ccc; padding: 10px; height: 300px; overflow-y: auto; }
            .message { margin: 5px 0; padding: 5px; border-radius: 5px; }
            .user { background: #e3f2fd; text-align: right; }
            .assistant { background: #f3e5f5; }
            .system { background: #fff3cd; }
            .error { background: #ffebee; color: #c62828; }
            input { width: 70%; padding: 5px; }
            button { padding: 5px 10px; }
        </style>
    </head>
    <body>
        <h1>WebSocket Chat Test</h1>
        <div id="messages"></div>
        <input type="text" id="messageInput" placeholder="Type a message...">
        <button onclick="sendMessage()">Send</button>
        <button onclick="sendAudio()">Send Audio</button>
        
        <script>
            const ws = new WebSocket(`ws://${window.location.host}/chat/test-session?token=test-token`);
            const messages = document.getElementById('messages');
            const input = document.getElementById('messageInput');
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                const div = document.createElement('div');
                div.className = `message ${data.type}`;
                div.innerHTML = `<strong>${data.type}:</strong> ${data.content || ''}`;
                messages.appendChild(div);
                messages.scrollTop = messages.scrollHeight;
            };
            
            function sendMessage() {
                const message = {
                    type: 'text',
                    content: input.value,
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(message));
                input.value = '';
            }
            
            function sendAudio() {
                // Simulate audio data (base64 encoded silence)
                const audioData = 'AAAAAA=='; // 4 bytes of silence
                const message = {
                    type: 'audio',
                    audio_data: audioData,
                    sample_rate: 16000,
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(message));
            }
            
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
