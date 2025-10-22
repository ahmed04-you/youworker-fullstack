# STT/TTS Pipeline UX/UI Analysis

**Date**: 2025-10-21
**Current Status**: ✅ Functional, ⚠️ UX Improvements Needed

---

## Current Implementation

### ✅ What's Working Well

#### 1. Voice Input (STT)
- **Microphone button** with clear visual states:
  - 🎤 Gray (idle) → Red (recording)
  - Proper labels: "Parla" / "Interrompi registrazione"
  - Accessible with aria-labels

#### 2. Audio Output (TTS)
- **Speaker toggle button** to enable/disable audio responses:
  - 🔊 Gray (disabled) → Blue (enabled)
  - Labels: "Risposta audio disattiva" / "Risposta audio attiva"
  - State persists during conversation

#### 3. Error Handling
- Toast notifications for:
  - Microphone permission denied
  - No microphone found
  - WebSocket connection failures
  - TTS playback errors

#### 4. Italian Language
- All UI labels in Italian
- Web Speech API configured for it-IT
- Piper TTS uses Italian voice

---

## ⚠️ UX Issues and Recommendations

### Issue 1: No Transcription Feedback

**Problem**:
User speaks but doesn't see transcript appearing in real-time. The transcript only appears when recording stops.

**Current Code**:
```typescript
sttWs.onmessage = (ev) => {
  const msg = JSON.parse(ev.data as string)
  if (msg.type === "partial" && typeof msg.text === "string") {
    setMessage(msg.text)  // ✅ Updates message
  }
}
```

**Analysis**:
The code IS updating the message in real-time, but users might not notice because:
1. The textarea is where they're looking at the keyboard/mic
2. No visual "transcribing..." indicator
3. No confidence score feedback

**Recommendation**:
```typescript
// Add transcription status indicator
const [transcribing, setTranscribing] = useState(false)

// Show indicator in UI
{recording && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground px-3">
    <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
    {transcribing ? "Trascrizione in corso..." : "In ascolto..."}
  </div>
)}
```

---

### Issue 2: No Audio Playback Indicator

**Problem**:
When TTS is playing, there's no visual feedback. Users can't tell if:
- Audio is loading
- Audio is playing
- Audio finished or failed

**Current Code**:
```typescript
// page.tsx - TTS playback happens silently
if (expectAudio && finalText) {
  const tts = new WebSocket(ttsUrl)
  tts.onmessage = async (ev) => {
    await player.playChunk(b)  // No UI feedback
  }
}
```

**Recommendation**:
```typescript
// Add playing state to chat context
const [audioPlaying, setAudioPlaying] = useState(false)

// Show indicator in UI
{audioPlaying && (
  <div className="flex items-center gap-2 text-sm text-primary px-3 py-2">
    <Volume2 className="h-4 w-4 animate-pulse" />
    Riproduzione audio...
  </div>
)}
```

---

### Issue 3: No Loading States

**Problem**:
WebSocket connections can take 1-2 seconds. No spinner/feedback during:
- MCP connection
- Session creation
- Audio initialization

**Recommendation**:
```typescript
const [connecting, setConnecting] = useState(false)

const startRecording = async () => {
  setConnecting(true)
  try {
    // ... connection logic
  } finally {
    setConnecting(false)
  }
}

// UI
<Button disabled={connecting}>
  {connecting ? (
    <Loader2 className="h-5 w-5 animate-spin" />
  ) : (
    <Mic className="h-5 w-5" />
  )}
</Button>
```

---

### Issue 4: Auto-Submit on Stop Recording

**Problem**:
Current behavior (from stopRecording function):
```typescript
const stopRecording = () => {
  // ... cleanup
  const txt = (message || "").trim()
  if (txt) onSubmit(txt)  // ⚠️ Auto-submits!
}
```

This means:
- User can't review transcript before sending
- Can't edit STT mistakes
- Can't cancel if STT misheard

**Recommendation**:
```typescript
// Option 1: Remove auto-submit (let user click Send)
const stopRecording = () => {
  // ... cleanup
  setRecording(false)
  // User manually clicks Send button
}

// Option 2: Add confirmation dialog
const stopRecording = () => {
  // ... cleanup
  setShowTranscriptConfirm(true)  // Show modal to review/edit
}
```

---

### Issue 5: No Waveform/Audio Visualization

**Problem**:
User can't tell if microphone is picking up audio or if they're speaking too quietly/loudly.

**Recommendation**:
```typescript
// Add audio level visualization
const [audioLevel, setAudioLevel] = useState(0)

// In AudioWorklet processor
process(inputs, outputs, parameters) {
  const rms = calculateRMS(channelData)
  this.port.postMessage({ type: 'audiolevel', level: rms })
}

// UI - simple volume bars
<div className="flex gap-1 items-end h-6">
  {Array.from({ length: 10 }).map((_, i) => (
    <div
      key={i}
      className={cn(
        "w-1 rounded-full transition-all",
        audioLevel > (i + 1) * 10 ? "bg-rose-500" : "bg-muted"
      )}
      style={{ height: `${(i + 1) * 10}%` }}
    />
  ))}
</div>
```

---

### Issue 6: Error Messages Only in Toasts

**Problem**:
Toast notifications disappear after a few seconds. If user misses it, they don't know what went wrong.

**Recommendation**:
```typescript
// Persistent error state
const [recordingError, setRecordingError] = useState<string | null>(null)

// Show inline error (doesn't disappear)
{recordingError && (
  <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-lg">
    <AlertCircle className="h-4 w-4" />
    <span>{recordingError}</span>
    <button onClick={() => setRecordingError(null)}>
      <X className="h-4 w-4" />
    </button>
  </div>
)}
```

---

### Issue 7: No Keyboard Shortcuts

**Problem**:
Everything requires mouse clicks. Power users can't use keyboard shortcuts.

**Recommendation**:
```typescript
// Add keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + M = Toggle recording
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault()
      recording ? stopRecording() : startRecording()
    }

    // Ctrl/Cmd + Shift + A = Toggle audio response
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'a') {
      e.preventDefault()
      setExpectAudio(v => !v)
    }
  }

  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [recording])

// Show shortcuts in tooltips
<Button title="Parla (Ctrl+M)">
  <Mic />
</Button>
```

---

### Issue 8: No Mobile Optimization

**Problem**:
Current implementation assumes desktop. On mobile:
- Buttons might be too small for touch
- No haptic feedback
- No permission pre-check

**Recommendation**:
```typescript
// Check if mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Larger touch targets on mobile
<Button
  className={cn(
    "rounded-2xl transition-colors",
    isMobile ? "h-14 w-14" : "h-11 w-11"
  )}
>
  <Mic className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
</Button>

// Haptic feedback (if available)
const vibrate = () => {
  if (navigator.vibrate && isMobile) {
    navigator.vibrate(50)
  }
}

<Button onClick={() => { vibrate(); startRecording() }}>
```

---

### Issue 9: No Confidence Scores Display

**Problem**:
STT returns confidence scores, but they're not shown to users. Users can't tell if transcription was accurate.

**Current Backend** (already implemented):
```python
await ws.send_text(json.dumps({
    "type": "partial",
    "text": text,
    "confidence": round(avg_confidence, 3),  # ✅ Available!
    ...
}))
```

**Recommendation**:
```typescript
// Show confidence in UI
const [confidence, setConfidence] = useState<number | null>(null)

sttWs.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.type === "partial") {
    setMessage(msg.text)
    setConfidence(msg.confidence)
  }
}

// Visual indicator
{confidence !== null && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span>Affidabilità:</span>
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            confidence > (i + 1) * 0.2 ? "bg-green-500" : "bg-muted"
          )}
        />
      ))}
    </div>
    <span>{(confidence * 100).toFixed(0)}%</span>
  </div>
)}
```

---

## Recommended UX Improvements (Priority Order)

### 🔴 High Priority (Blocking Issues)

1. **Remove auto-submit on stopRecording** - Let users review transcript
   - Impact: Prevents accidental sends
   - Effort: 5 minutes

2. **Add TTS playback indicator** - Show when audio is playing
   - Impact: Critical for user feedback
   - Effort: 15 minutes

3. **Add loading states** - Show spinners during connection
   - Impact: Reduces perceived latency
   - Effort: 20 minutes

### 🟡 Medium Priority (Usability)

4. **Add real-time transcription indicator** - Show "Transcribing..." text
   - Impact: Confirms STT is working
   - Effort: 10 minutes

5. **Add inline error messages** - Persistent errors instead of toasts
   - Impact: Users see errors clearly
   - Effort: 15 minutes

6. **Add audio level visualization** - Waveform or volume bars
   - Impact: Confirms mic is working
   - Effort: 30 minutes

### 🟢 Low Priority (Polish)

7. **Add keyboard shortcuts** - Power user feature
   - Impact: Faster workflow for frequent users
   - Effort: 20 minutes

8. **Add confidence scores display** - Show transcription accuracy
   - Impact: Users know when to review/edit
   - Effort: 15 minutes

9. **Mobile optimization** - Larger touch targets, haptics
   - Impact: Better mobile experience
   - Effort: 30 minutes

---

## Implementation Example

Here's a complete example of improved UX for the recording button:

```typescript
const [recording, setRecording] = useState(false)
const [connecting, setConnecting] = useState(false)
const [transcribing, setTranscribing] = useState(false)
const [audioLevel, setAudioLevel] = useState(0)
const [confidence, setConfidence] = useState<number | null>(null)
const [error, setError] = useState<string | null>(null)

const startRecording = async () => {
  setConnecting(true)
  setError(null)

  try {
    // ... connection logic
    setRecording(true)
    setTranscribing(true)
  } catch (err) {
    setError(err.message)
  } finally {
    setConnecting(false)
  }
}

return (
  <div className="flex flex-col gap-2">
    {/* Recording button with status */}
    <div className="flex items-center gap-3">
      <Button
        onClick={recording ? stopRecording : startRecording}
        disabled={connecting}
        className={cn(
          "h-11 w-11 rounded-2xl transition-all",
          recording && "bg-rose-600 text-white animate-pulse"
        )}
      >
        {connecting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {/* Status text */}
      {recording && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          {transcribing ? "Trascrizione..." : "In ascolto..."}
        </div>
      )}
    </div>

    {/* Audio level visualization */}
    {recording && (
      <div className="flex gap-1 items-end h-6 px-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all",
              audioLevel > (i + 1) * 10 ? "bg-rose-500" : "bg-muted"
            )}
            style={{ height: `${Math.max(10, (i + 1) * 10)}%` }}
          />
        ))}
      </div>
    )}

    {/* Confidence indicator */}
    {confidence !== null && (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
        <span>Affidabilità:</span>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                confidence > (i + 1) * 0.2 ? "bg-green-500" : "bg-muted"
              )}
            />
          ))}
        </div>
        <span>{(confidence * 100).toFixed(0)}%</span>
      </div>
    )}

    {/* Inline error */}
    {error && (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
        <button onClick={() => setError(null)} className="ml-auto">
          <X className="h-4 w-4" />
        </button>
      </div>
    )}
  </div>
)
```

---

## Summary

### Current UX Score: 6/10

**What's Good:**
✅ Basic functionality works
✅ Visual button states
✅ Error handling with toasts
✅ Italian language support
✅ Accessible with ARIA labels

**What Needs Improvement:**
❌ No transcription feedback
❌ No audio playback indicator
❌ No loading states
❌ Auto-submit is confusing
❌ No audio visualization
❌ Errors disappear (toasts)
❌ No keyboard shortcuts
❌ No confidence scores shown

### Recommended Target: 9/10

With the high-priority improvements implemented (1-3), the UX would reach **8/10**.
With medium-priority improvements (4-6), the UX would reach **9/10**.

---

## Next Steps

If you'd like me to implement these UX improvements, I can:

1. **Quick fixes** (30 min total):
   - Remove auto-submit
   - Add TTS playback indicator
   - Add loading states

2. **Comprehensive UX overhaul** (2 hours total):
   - All high + medium priority improvements
   - Full visual feedback system
   - Polished user experience

Let me know which approach you'd prefer!
