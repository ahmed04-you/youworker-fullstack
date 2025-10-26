# Chat Architecture Documentation

## Overview

The Chat V2 architecture provides a complete refactoring of the chat pipeline with real-time WebSocket communication, enhanced audio streaming capabilities, and a modern responsive UI.

## Backend Components

### 1. WebSocket Connection Manager (`apps/api/websocket_manager.py`)

Manages WebSocket connections for real-time bidirectional communication.

**Features:**
- Connection pooling and session management
- Heartbeat monitoring with automatic cleanup
- Message broadcasting to sessions and users
- Reconnection handling with exponential backoff

**Key Methods:**
- `connect()`: Register new WebSocket connection
- `disconnect()`: Remove connection and cleanup
- `send_message()`: Send message to specific connection
- `broadcast_to_session()`: Send to all connections in a session
- `update_heartbeat()`: Update connection heartbeat

### 2. Enhanced Audio Pipeline (`apps/api/audio_pipeline_v2.py`)

Provides streaming audio processing for real-time STT and TTS.

**Features:**
- Chunk-based audio processing with voice activity detection
- High-quality audio resampling using scipy
- Streaming transcription with Whisper
- Streaming speech synthesis with Piper
- Noise reduction and adaptive quality settings

**Key Classes:**
- `StreamingAudioProcessor`: Handles real-time audio chunks
- `stream_transcribe_audio()`: Async transcription generator
- `stream_synthesize_speech()`: Async TTS generator

### 3. Unified Chat Endpoint (`apps/api/routes/chat/v2.py`)

WebSocket endpoint for real-time chat communication.

**Features:**
- Text and audio message handling
- Real-time streaming responses
- Tool execution with progress updates
- Audio streaming for TTS
- Fallback HTTP endpoint for compatibility

**Endpoints:**
- `WebSocket /v2/chat/{session_id}`: Real-time chat
- `POST /v2/chat`: Fallback HTTP endpoint
- `GET /v2/chat/test`: WebSocket test page

## Frontend Components

### 1. WebSocket Client (`apps/frontend/lib/websocket.ts`)

Client-side WebSocket wrapper with comprehensive error handling.

**Features:**
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Heartbeat/ping-pong mechanism
- Type-safe message handling
- Error recovery strategies

**Key Methods:**
- `connect()`: Establish WebSocket connection
- `sendMessage()`: Send message with queuing
- `disconnect()`: Clean connection termination
- `reconnect()`: Manual reconnection trigger

### 2. Modern Chat UI (`apps/frontend/components/chat/chat-v2.tsx`)

Responsive chat interface with real-time updates.

**Features:**
- Real-time message streaming
- Voice recording with visual feedback
- Audio playback for TTS responses
- Message actions (copy, edit, regenerate)
- Connection status indicators
- Tool execution visualization

**UI Components:**
- Message bubbles with timestamps
- Streaming text indicators
- Voice recording controls
- Connection status badges
- Reconnection controls

### 3. Chat V2 Page (`apps/frontend/app/(shell)/chat-v2/page.tsx`)

Page wrapper for the new chat interface.

**Features:**
- Session ID management
- Authentication token handling
- Loading states

## Message Flow

### Text Message Flow
1. User types message and clicks send
2. Frontend sends WebSocket message with type "text"
3. Backend receives message and processes with agent loop
4. Backend streams response tokens as WebSocket messages
5. Frontend displays streaming text in real-time
6. Backend sends final message with is_final flag
7. Frontend commits message to chat history

### Audio Message Flow
1. User clicks microphone button to start recording
2. Frontend captures audio using MediaRecorder API
3. User stops recording, audio is converted to PCM16 base64
4. Frontend sends WebSocket message with type "audio"
5. Backend transcribes audio using Whisper
6. Backend sends transcript message back to client
7. Backend processes transcript as text message
8. Response flows back through text message flow

### Tool Execution Flow
1. Agent determines tool is needed
2. Backend sends tool start message with status "start"
3. Backend executes tool and captures result
4. Backend sends tool end message with status "end"
5. Frontend displays tool execution progress

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- User notification of connection status
- Manual reconnection button

### Message Errors
- Graceful degradation for unsupported message types
- Error messages displayed to user
- Failed message queuing for retry

### Audio Errors
- Fallback to text input if recording fails
- Audio playback error handling
- Transcription confidence indicators

## Performance Optimizations

### Backend
- Streaming responses reduce latency
- Chunk-based audio processing
- Connection pooling for WebSocket management
- Lazy loading of ML models

### Frontend
- RequestAnimationFrame for smooth text streaming
- Audio context optimization
- Component memoization
- Efficient scroll management

## Accessibility

### Keyboard Navigation
- Tab order management
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Focus management after actions

### Screen Reader Support
- ARIA labels and roles
- Live regions for status updates
- Semantic HTML structure

### Visual Indicators
- High contrast colors
- Focus indicators
- Status badges with text alternatives

## Mobile Optimization

### Responsive Design
- Flexible layout with mobile-first approach
- Touch-friendly button sizes
- Optimized input areas

### Performance
- Reduced animation on low-end devices
- Efficient audio processing
- Minimal re-renders

## Security Considerations

### Authentication
- Token-based WebSocket authentication
- Session validation
- Connection rate limiting

### Data Protection
- Input sanitization
- XSS prevention
- Secure audio handling

## Testing

### Unit Tests
- WebSocket client behavior
- Audio processing functions
- Message handling logic

### Integration Tests
- End-to-end message flow
- Connection resilience
- Audio transcription accuracy

### E2E Tests
- Complete user workflows
- Cross-browser compatibility
- Mobile device testing

## Future Enhancements

### Planned Features
- Multi-language support
- File attachment support
- Message threading
- User presence indicators

### Performance Improvements
- WebRTC for peer-to-peer audio
- Service worker for offline support
- Optimized bundle sizes

## Migration Guide

### Implementation Notes
1. WebSocket endpoint URLs use `/chat/{session_id}`
2. WebSocket client replaces SSE client
3. Message handling updated for new event types
4. Audio recording migrated to new format
5. UI components updated to use Chat component

### Backward Compatibility
- V1 HTTP endpoints remain functional
- Gradual migration possible
- Feature flags for rollout control