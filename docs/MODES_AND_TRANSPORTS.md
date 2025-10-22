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

### Voice Mode: AudioWSClient

Uses WebSocket connections for audio streaming:

```typescript
const audioClient = new AudioWSClient(24000)
await audioClient.openSTT(callbacks)
await audioClient.openTTS(callbacks)
```

Features:
- 24kHz PCM16 audio streaming
- 20ms frame chunks for low latency
- Push-to-Talk and Auto-VAD modes
- Barge-in support for voice interruptions
- Real-time partial transcripts
- Streaming TTS with pause/resume/cancel

## Voice Mode Features

### Speech-to-Text (STT)

- **Provider**: faster-whisper with VAD support
- **Sample Rate**: 24kHz PCM16
- **Frame Size**: 20ms chunks
- **Languages**: Auto-detect with Italian fallback
- **VAD**: Voice Activity Detection for utterance segmentation
- **Partial Transcripts**: Real-time streaming with confidence scores
- **Final Transcripts**: Triggered by silence detection

### Text-to-Speech (TTS)

- **Provider**: Piper TTS (default: it_IT-paola-medium)
- **Sample Rate**: Matched to voice model (typically 22kHz or 24kHz)
- **Streaming**: 80ms audio chunks
- **Voices**: Configurable via environment variables
- **Fallback**: Sine wave generator if Piper unavailable

### Barge-in Control

Voice interruptions are handled gracefully:

```typescript
// Pause TTS when user starts speaking
audioClient.controlBargeIn("pause")

// Resume TTS
audioClient.controlBargeIn("resume")

// Cancel TTS completely
audioClient.controlBargeIn("cancel")
```

## Configuration

### Environment Variables

#### STT Configuration
```bash
STT_PROVIDER=faster-whisper          # STT provider
STT_MODEL=large-v3                   # Whisper model size
STT_DEVICE=auto                      # Device: auto, cpu, cuda
STT_COMPUTE_TYPE=float16             # Compute type: float16, int8
STT_VAD_ENABLED=true                 # Enable VAD
STT_BEAM_SIZE=1                      # Beam size for decoding
STT_MIN_SILENCE_MS=400               # Minimum silence for final
STT_CHUNK_SIZE_MS=400                # Processing chunk size
```

#### TTS Configuration
```bash
TTS_PROVIDER=piper                   # TTS provider
TTS_VOICE=it_IT-paola-medium         # Voice model
TTS_MODEL_DIR=/app/models/tts        # Model directory
```

#### Audio Processing
```bash
AUDIO_SAMPLE_RATE=24000              # Default sample rate
AUDIO_FRAME_MS=20                    # Frame size in milliseconds
```

## Cross-Browser Compatibility

### Supported Browsers

- **Chrome**: Full support (SSE + WebSocket + AudioWorklet)
- **Safari**: Full support (SSE + WebSocket + AudioWorklet)
- **Firefox**: Full support (SSE + WebSocket + AudioWorklet)

### Browser-Specific Considerations

1. **HTTPS Required**: Microphone access requires secure context
2. **User Gesture**: Audio context requires user interaction
3. **AudioWorklet**: All modern browsers support AudioWorklet
4. **WebSocket**: Standard WebSocket support across browsers
5. **SSE**: Standard EventSource support across browsers

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
audioClient.close()
```

### Global Resource Tracking

Resources are tracked globally for emergency cleanup:
- Active EventSource connections
- WebSocket connections
- Audio contexts
- Media streams

### Memory Management

- Ring buffer limits (10 seconds max)
- Session TTL (5 minutes default)
- Automatic stale session cleanup
- Audio chunk queue management

## Error Handling

### Text Mode Errors

- SSE connection failures: Automatic reconnection
- Network timeouts: Exponential backoff
- Parse errors: Graceful degradation
- Heartbeat timeouts: Connection reset

### Voice Mode Errors

- Microphone permission denied: User-friendly message
- No microphone found: Clear error indication
- STT service unavailable: Fallback handling
- TTS service unavailable: Fallback sine wave
- WebSocket disconnections: Automatic reconnection

## Performance Metrics

### Text Mode Metrics

- **Token Latency**: Time from request to first token
- **SSE Reconnection**: Time to recover from disconnections
- **Heartbeat Monitoring**: Connection health tracking

### Voice Mode Metrics

- **STT Latency**: Partial-to-final transcript time
- **TTS Latency**: Time-to-first-audio
- **Barge-in Latency**: Pause response time
- **Audio Chunk Size**: 20ms frames for low latency

## Testing

### Mode Isolation Tests

- Verify mode switching closes previous transports
- Ensure no resource leaks during mode changes
- Test concurrent mode operations
- Validate cross-browser compatibility

### Transport Tests

- SSE reconnection behavior
- WebSocket connection stability
- Audio streaming performance
- Barge-in functionality

### Integration Tests

See `tests/integration/test_mode_switching.py` for comprehensive tests covering:
- Mode switching functionality
- Transport isolation
- Cross-browser compatibility
- Resource cleanup
- Performance metrics

## Migration Guide

### From Hybrid Mode

If migrating from a hybrid text+voice implementation:

1. **Remove Web Speech API**: No longer needed
2. **Update UI Components**: Use mode-specific rendering
3. **Refactor Audio Logic**: Use AudioWSClient
4. **Update SSE Logic**: Use SSEClient
5. **Add Mode Toggle**: Implement mode switching UI

### Configuration Migration

Update environment variables to use new configuration format:

```bash
# Old format
STT_COMPUTE=gpu

# New format  
STT_DEVICE=cuda
STT_COMPUTE_TYPE=float16
```

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