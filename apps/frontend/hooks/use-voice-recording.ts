"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { VoiceRecorder } from "@/lib/voice-recorder"
import { uint8ToBase64 } from "@/lib/audio-utils"

interface VoiceTurnArgs {
  audioBase64: string
  sampleRate: number
}

interface UseVoiceRecordingProps {
  onVoiceTurn?: (args: VoiceTurnArgs) => Promise<string | void>
  isStreaming?: boolean
}

export function useVoiceRecording({ onVoiceTurn, isStreaming = false }: UseVoiceRecordingProps) {
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [lastTranscript, setLastTranscript] = useState("")
  const preventClickRef = useRef(false)

  // Initialize voice recorder
  useEffect(() => {
    const recorder = new VoiceRecorder(16000)
    recorderRef.current = recorder

    return () => {
      recorder.dispose().catch(() => undefined)
      recorderRef.current = null
    }
  })

  const handleVoiceStart = useCallback(async () => {
    if (recording || processing || isStreaming || !recorderRef.current) {
      return
    }
    if (!onVoiceTurn) {
      toast.error("Input vocale non disponibile")
      return
    }

    preventClickRef.current = false
    setRecordingError(null)
    setLastTranscript("")
    setConnecting(true)

    try {
      await recorderRef.current.start({
        onAudioLevel: (level: number) => setAudioLevel(level),
        onStart: () => {
          setRecording(true)
          setConnecting(false)
        },
        onStop: () => {
          setRecording(false)
          setAudioLevel(0)
        },
      })
      // If start resolves before onStart fires (rare), ensure flags are set
      if (!recording) {
        setRecording(true)
        setConnecting(false)
      }
    } catch (err) {
      setConnecting(false)
      setRecording(false)
      setAudioLevel(0)
      const error = err as Error
      const message = error.message || "Impossibile avviare la registrazione. Riprova."
      setRecordingError(message)
      toast.error(message)
    }
  }, [isStreaming, onVoiceTurn, processing, recording])

  const handleVoiceStop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !recorder.isRecording) {
      return
    }

    setConnecting(false)

    let pcm: Uint8Array
    try {
      pcm = await recorder.stop()
    } catch (err) {
      const message = (err as Error).message || "Errore durante la chiusura della registrazione."
      setRecordingError(message)
      toast.error(message)
      return
    }

    setRecording(false)
    setAudioLevel(0)

    if (!onVoiceTurn) {
      return
    }

    if (pcm.length === 0) {
      toast.warning("Nessun audio registrato. Riprova.")
      return
    }

    setProcessing(true)
    try {
      const transcript = await onVoiceTurn({
        audioBase64: uint8ToBase64(pcm),
        sampleRate: recorder.sampleRate,
      })
      if (typeof transcript === "string" && transcript.trim()) {
        setLastTranscript(transcript.trim())
      }
    } catch (err) {
      const message = (err as Error).message || "Errore durante l'elaborazione della richiesta vocale."
      setRecordingError(message)
      toast.error(message)
    } finally {
      setProcessing(false)
    }
  }, [onVoiceTurn])

  const handlePressStart = useCallback((event: any) => {
    preventClickRef.current = true
    if ("touches" in event) {
      event.preventDefault()
    }
    void handleVoiceStart()
  }, [handleVoiceStart])

  const handlePressEnd = useCallback((event: any) => {
    if ("touches" in event) {
      event.preventDefault()
    }
    preventClickRef.current = true
    void handleVoiceStop()
  }, [handleVoiceStop])

  const handleButtonClick = useCallback((event: any) => {
    if (preventClickRef.current) {
      event.preventDefault()
      preventClickRef.current = false
    }
  }, [])

  const clearError = useCallback(() => {
    setRecordingError(null)
  }, [])

  const clearTranscript = useCallback(() => {
    setLastTranscript("")
  }, [])

  return {
    recording,
    connecting,
    processing,
    recordingError,
    audioLevel,
    lastTranscript,
    buttonDisabled: (!recording && (processing || isStreaming)) || connecting,
    handlePressStart,
    handlePressEnd,
    handleButtonClick,
    clearError,
    clearTranscript,
  }
}
