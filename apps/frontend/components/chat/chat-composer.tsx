"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { Send, Square, Mic, Volume2, Loader2, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spotlight } from "@/components/aceternity/spotlight"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useComposerContext } from "@/lib/contexts/composer-context"
import { cn } from "@/lib/utils"
import { useMode } from "@/lib/mode"
import { VoiceRecorder } from "@/lib/voice-recorder"
import { uint8ToBase64 } from "@/lib/audio-utils"

interface VoiceTurnArgs {
  audioBase64: string
  sampleRate: number
}

interface ChatComposerProps {
  onSubmit: (content: string) => void
  onStop: () => void
  onVoiceTurn?: (args: VoiceTurnArgs) => Promise<string | void>
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

const MAX_TEXTAREA_HEIGHT = 200

export function ChatComposer({ onSubmit, onStop, onVoiceTurn, textareaRef }: ChatComposerProps) {
  const {
    isStreaming,
    expectAudio,
    setExpectAudio,
    audioPlaying,
    suggestedPrompt,
    setSuggestedPrompt,
  } = useChatContext()
  const { mode } = useMode()
  const { registerComposer } = useComposerContext()
  const [message, setMessage] = useState("")
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useMemo(() => textareaRef ?? localTextareaRef, [textareaRef])

  // Voice mode state
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [lastTranscript, setLastTranscript] = useState("")
  const preventClickRef = useRef(false)

  useEffect(() => {
    if (suggestedPrompt) {
      setMessage(suggestedPrompt)
      setSuggestedPrompt("")
      composerRef.current?.focus()
    }
  }, [suggestedPrompt, setSuggestedPrompt, composerRef])

  useEffect(() => {
    registerComposer(composerRef.current)
    return () => registerComposer(null)
  }, [registerComposer, composerRef])

  useEffect(() => {
    if (mode === "voice") {
      setExpectAudio(true)
    }
  }, [mode, setExpectAudio])

  useEffect(() => {
    if (mode !== "voice") {
      setAudioLevel(0)
      setRecording(false)
      setProcessing(false)
      setConnecting(false)
      setLastTranscript("")
      recorderRef.current?.dispose()
      recorderRef.current = null
      return
    }

    const recorder = new VoiceRecorder(16000)
    recorderRef.current = recorder

    return () => {
      recorder.dispose().catch(() => undefined)
      recorderRef.current = null
    }
  }, [mode])

  const adjustTextareaHeight = useCallback(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = "auto"
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden"
  }, [composerRef])

  useEffect(() => {
    adjustTextareaHeight()
  }, [message, adjustTextareaHeight])

  useEffect(() => {
    adjustTextareaHeight()
  }, [adjustTextareaHeight])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isStreaming) return
    onSubmit(message)
    setMessage("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === "Escape" && isStreaming) {
      e.preventDefault()
      onStop()
    }
  }

  const handleVoiceStart = useCallback(async () => {
    if (mode !== "voice" || recording || processing || isStreaming || !recorderRef.current) {
      return
    }
    if (!onVoiceTurn) {
      toast.error("Modalità voce non disponibile")
      return
    }

    preventClickRef.current = false
    setRecordingError(null)
    setLastTranscript("")
    setConnecting(true)

    try {
      await recorderRef.current.start({
        onAudioLevel: (level) => setAudioLevel(level),
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
  }, [isStreaming, mode, onVoiceTurn, processing, recording])

  const handleVoiceStop = useCallback(async () => {
    const recorder = recorderRef.current
    if (mode !== "voice" || !recorder || !recorder.isRecording) {
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
  }, [mode, onVoiceTurn, recording])

  const handlePressStart = (event: React.MouseEvent | React.TouchEvent) => {
    preventClickRef.current = true
    if ("touches" in event) {
      event.preventDefault()
    }
    void handleVoiceStart()
  }

  const handlePressEnd = (event: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in event) {
      event.preventDefault()
    }
    preventClickRef.current = true
    void handleVoiceStop()
  }

  const handleButtonClick = (event: React.MouseEvent) => {
    if (preventClickRef.current) {
      event.preventDefault()
      preventClickRef.current = false
    }
  }

  if (mode === "text") {
    return (
      <div className="relative w-full border-t border-border/50 bg-background/60 backdrop-blur-md">
        <Spotlight className="opacity-20" fill="hsl(var(--primary))" />
        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="relative z-10 w-full"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
            <div className="flex w-full flex-col gap-4 rounded-[24px] border border-border/60 bg-background/80 shadow-xl shadow-primary/5 backdrop-blur-md">
              <Textarea
                ref={composerRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi il tuo messaggio..."
                className="min-h-[96px] w-full resize-none rounded-3xl border border-border/60 bg-background px-5 py-4 text-sm shadow-inner transition-[border-color,box-shadow] focus:border-primary/60 focus-visible:ring-0"
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="ml-3 mb-3 flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setExpectAudio((v) => !v)}
                    aria-pressed={expectAudio}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                      expectAudio ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                    title={expectAudio ? "Risposta audio attiva" : "Risposta audio disattivata"}
                    aria-label={expectAudio ? "Risposta audio attiva" : "Risposta audio disattivata"}
                  >
                    <Volume2 className="h-5 w-5" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {expectAudio ? "Audio attivo" : "Audio disattivato"}
                  </span>
                </div>

                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={onStop}
                    variant="destructive"
                    className="mr-3 mb-3 flex h-11 w-11 items-center justify-center rounded-2xl shadow-md hover:bg-destructive/90"
                    title="Interrompi"
                    aria-label="Interrompi"
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="mr-3 mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                    disabled={!message.trim()}
                    title="Invia"
                    aria-label="Invia"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {audioPlaying && (
                <div className="flex items-center gap-2 px-5 pb-3 text-sm text-primary">
                  <Volume2 className="h-4 w-4 animate-pulse" />
                  <span>Riproduzione risposta audio...</span>
                </div>
              )}
            </div>
          </div>
        </motion.form>
      </div>
    )
  }

  const buttonDisabled = (!recording && (processing || isStreaming)) || connecting

  return (
    <div className="relative w-full border-t border-border/50 bg-background/60 backdrop-blur-md">
      <Spotlight className="opacity-20" fill="hsl(var(--primary))" />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 w-full"
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
          <div className="flex w-full flex-col gap-4 rounded-[24px] border border-border/60 bg-background/80 p-6 shadow-xl shadow-primary/5 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
              <Button
                type="button"
                disabled={buttonDisabled}
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                onClick={handleButtonClick}
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 shadow-lg",
                  recording
                    ? "scale-105 bg-rose-600 text-white shadow-rose-600/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                  buttonDisabled && !recording && "cursor-not-allowed opacity-70",
                )}
                title={
                  recording
                    ? "Rilascia per fermare"
                    : buttonDisabled
                      ? "Elaborazione in corso..."
                      : "Tieni premuto per parlare"
                }
                aria-label={
                  recording
                    ? "Rilascia per fermare"
                    : buttonDisabled
                      ? "Elaborazione in corso..."
                      : "Tieni premuto per parlare"
                }
              >
                {connecting || processing || isStreaming ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {recording
                    ? "Ascolto... rilascia per fermare"
                    : buttonDisabled
                      ? "Attendi il completamento della risposta"
                      : "Tieni premuto il pulsante e parla"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-start border-t border-border/50 pt-4 text-sm text-primary">
              <Volume2 className="mr-2 h-4 w-4" />
              <span>La risposta vocale verrà riprodotta automaticamente.</span>
            </div>

            {lastTranscript && (
              <div className="rounded-lg border border-border/30 bg-muted/50 p-3">
                <p className="text-sm text-foreground">{lastTranscript}</p>
              </div>
            )}

            {(processing || isStreaming) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Elaborazione della richiesta...</span>
              </div>
            )}

            {recording && (
              <div className="flex items-center gap-2">
                <div className="flex h-4 flex-1 items-end gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-all duration-75",
                        audioLevel > (i + 1) * 5 ? "bg-rose-500" : "bg-muted-foreground/30",
                      )}
                      style={{ height: `${Math.max(20, (i + 1) * 5)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {recordingError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{recordingError}</span>
                <button
                  onClick={() => setRecordingError(null)}
                  className="flex-shrink-0 rounded p-1 transition-colors hover:bg-destructive/20"
                  aria-label="Chiudi errore"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {audioPlaying && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Volume2 className="h-4 w-4 animate-pulse" />
                <span>Riproduzione risposta vocale...</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
