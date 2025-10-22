# Communication Modes & Transports

This document describes the text-only and voice-only communication modes, their implementation, and transport mechanisms.

## Overview

YouWorker.AI supports two mutually exclusive communication modes:

- **Text Mode**: Traditional text-based chat with SSE streaming
- **Voice Mode**: Speech-to-text input with text-to-speech output

Users can switch between modes at any time, but each session uses only one mode. Mode switching cleans up all resources from the previous mode.

## Mode Architecture

### Global Mode Store

The mode system is built around a React context provider (`ModeProvider`) that manages:

- Current communication mode (`text` | `voice`)
- Mode switching logic with capability validation
- Transport cleanup on mode changes
- Auto-detection of voice capabilities

```typescript
// Usage in components
const { mode, setMode, isModeSwitching } = useMode()
```

### Mode Toggle UI

A prominent mode switcher is available in the main interface:

- **Text Mode Button**: Shows text input composer
- **Voice Mode Button**: Shows microphone controls and speaker toggle
- Visual feedback during mode switching
- Disabled during active streaming

## Transport Layer

### Text Mode: SSEClient

Uses Server-Sent Events for real-time streaming:

```typescript
const sseClient = new SSEClient(sessionId)
await sseClient.open(request, callbacks)
```

Features:
- Single EventSource per session
- Automatic reconnection with exponential backoff
- Heartbeat monitoring (45s timeout)
- Named SSE events (`token`, `tool`, `log`, `heartbeat`, `done`)
- UTF-8 encoding with periodic padding comments

### Voice Mode: Turn-based Voice Pipeline

Voice interactions now run through a single HTTP request per utterance:

1. The browser records audio with the `VoiceRecorder` AudioWorklet at 16kHz PCM16.
2. When the user releases the push-to-talk button, the PCM buffer is
   base64-encoded and sent to `POST /v1/voice-turn` together with the chat
   history.
3. The API service transcribes the audio (faster-whisper), executes the agent
   loop, and optionally synthesizes a reply (Piper TTS).
4. The response returns the transcript, assistant text, metadata, and an
   optional WAV clip which the browser plays with a standard `Audio` element.

No persistent WebSocket connections are required—the entire turn is processed in
a single request/response cycle.

## Voice Mode Features

### Speech-to-Text (STT)

- **Provider**: faster-whisper (lazy-loaded inside the API service)
- **Sample Rate**: 16kHz PCM16 input from the browser
- **Transcription**: Batch transcription per utterance with average confidence
- **Language Detection**: Automatic with whisper metadata
- **Error Handling**: Returns HTTP 503 if the model is unavailable

### Text-to-Speech (TTS)

- **Provider**: Piper TTS (default voice: `it_IT-paola-medium`)
- **Output**: WAV-encoded clip returned as base64
- **Playback**: Browser `Audio` element handles the returned clip
- **Fallback**: Short sine-wave tone if no TTS engine is available

### Push-to-Talk UX

- AudioWorklet-based recorder with live level meter
- Press-and-hold button in voice mode (mouse and touch supported)
- Automatic focus restore on completion
- Graceful cancellation when the user loses focus mid-press

## Configuration

### Environment Variables

```bash
STT_MODEL=large-v3            # Whisper model name (lazy-loaded)
STT_DEVICE=auto               # Device: auto, cpu, cuda
STT_COMPUTE_TYPE=float16      # Precision: float16, int8, auto
STT_BEAM_SIZE=1               # Beam search size for decoding
TTS_PROVIDER=piper            # TTS backend
TTS_VOICE=it_IT-paola-medium  # Default Piper voice
TTS_MODEL_DIR=/app/models/tts # Directory containing Piper voices
```

## Cross-Browser Compatibility

### Supported Browsers

- **Chrome**: Full support (SSE + AudioWorklet)
- **Safari**: Full support (SSE + AudioWorklet)
- **Firefox**: Full support (SSE + AudioWorklet)

### Browser-Specific Considerations

1. **HTTPS Required**: Microphone access requires secure context
2. **User Gesture**: Audio context requires user interaction
3. **AudioWorklet**: All modern browsers support AudioWorklet
4. **SSE**: Standard EventSource support across browsers (text mode)

### No Web Speech API

The implementation does NOT use the Web Speech API, ensuring:
- Consistent behavior across browsers
- No Chrome-only dependencies
- Server-side STT for reliability
- Better control over audio processing

## Resource Management

### Transport Cleanup

All transports implement proper cleanup:

```typescript
// Automatic cleanup on mode switch
await cleanupTransports()

// Manual cleanup
sseClient.close()
voiceRecorder?.dispose()
```

### Global Resource Tracking

Resources are tracked globally for emergency cleanup:
- Active EventSource connections (text mode)
- VoiceRecorder instances
- Audio contexts
- Media streams

### Memory Management

- Recorder enforces push-to-talk (bounded utterance length)
- VoiceRecorder disposes AudioContext and tracks after each turn
- Audio elements revoke object URLs after playback

## Error Handling

### Text Mode Errors

- SSE connection failures: Automatic reconnection
- Network timeouts: Exponential backoff
- Parse errors: Graceful degradation
- Heartbeat timeouts: Connection reset

### Voice Mode Errors

- Microphone permission denied: User-friendly message
- No microphone found: Clear error indication
- STT model unavailable: Returns HTTP 503
- TTS engine unavailable: Fallback sine wave
- Upload failure: Recorder reset with retry prompt

## Performance Metrics

### Text Mode Metrics

- **Token Latency**: Time from request to first token
- **SSE Reconnection**: Time to recover from disconnections
- **Heartbeat Monitoring**: Connection health tracking

### Voice Mode Metrics

- **STT Latency**: Time from upload to transcript
- **Agent Latency**: Iterations to reach final answer
- **TTS Latency**: Time to synthesize and start playback
- **Turn RTT**: Total request duration (upload + processing)

## Testing

### Mode Isolation Tests

- Verify mode switching closes previous transports
- Ensure no resource leaks during mode changes
- Test concurrent mode operations
- Validate cross-browser compatibility

### Integration Tests

- `tests/integration/test_chat_endpoints.py` ensures text-mode SSE streaming,
  CORS behaviour, and voice endpoint error handling work end-to-end.
- `tests/unit/test_voice_turn_success.py` stubs expensive dependencies to cover
  a complete voice turn without loading real ML models.

## Operational Tips

- Expect a cold-start pause the first time `/v1/voice-turn` is invoked while
  Whisper and Piper models load. You can warm them up by issuing a synthetic
  request at startup.
- Clients must run on HTTPS (or localhost) to acquire microphone permissions. A
  reverse proxy or SSH tunnel is recommended for remote access.
- Keep an eye on `apps/api/audio_pipeline.py` when swapping STT/TTS providers:
  both loaders are pluggable and can be extended with additional backends.

## Troubleshooting

### Common Issues

1. **Microphone Not Working**: Check HTTPS and permissions
2. **No Audio Output**: Verify speaker permissions
3. **STT Not Responding**: Check faster-whisper model loading
4. **TTS Not Working**: Verify Piper model availability
5. **Mode Switch Fails**: Check for active streaming

### Debug Information

Enable debug logging:
```bash
LOG_LEVEL=DEBUG
```

Check health endpoints:
```bash
curl http://localhost:7006/health  # Audio server
curl http://localhost:8001/health  # API server
```

### Browser Console

Monitor for:
- WebSocket connection status
- AudioWorklet loading errors
- Microphone permission requests
- SSE connection events

## Future Enhancements

### Planned Features

- **Multi-language Support**: Enhanced language detection
- **Voice Profiles**: Personalized voice models
- **Advanced VAD**: Machine learning-based VAD
- **Noise Suppression**: Real-time audio enhancement
- **Voice Commands**: Wake word detection

### Performance Optimizations

- **Model Caching**: Faster model loading
- **Connection Pooling**: Reuse connections
- **Audio Compression**: Reduced bandwidth usage
- **Edge Processing**: Client-side audio processing

## Support

For issues or questions:
- Check the troubleshooting section
- Review browser console logs
- Verify environment configuration
- Run integration tests
- Check health endpoints
