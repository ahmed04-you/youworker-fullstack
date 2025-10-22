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
import { AudioWSClient } from "@/lib/transport/audio-ws-client"

interface ChatComposerProps {
  onSubmit: (content: string) => void
  onStop: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

const MAX_TEXTAREA_HEIGHT = 200

export function ChatComposer({ onSubmit, onStop, textareaRef }: ChatComposerProps) {
  const { isStreaming, expectAudio, setExpectAudio, audioPlaying, suggestedPrompt, setSuggestedPrompt, ttsSessionId } = useChatContext()
  const { mode } = useMode()
  const { registerComposer } = useComposerContext()
  const [message, setMessage] = useState("")
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useMemo(() => textareaRef ?? localTextareaRef, [textareaRef])

  // Voice Mode state
  const [recording, setRecording] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioClientRef = useRef<AudioWSClient | null>(null)
  const isHoldingRef = useRef(false)
  const shouldSubmitFinalRef = useRef(false)
  const lastFinalRef = useRef<string | null>(null)

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

  const submitFinalTranscript = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    lastFinalRef.current = null
    shouldSubmitFinalRef.current = false
    setMessage("")
  }, [onSubmit])

  // Initialize audio client for voice mode
  useEffect(() => {
    if (mode !== "voice") return

    const client = new AudioWSClient(24000)
    audioClientRef.current = client

    client.openSTT({
      onPartialTranscript: (text) => {
        setMessage(text)
        setTranscribing(true)
      },
      onFinalTranscript: (text) => {
        const trimmed = text.trim()
        setMessage(text)
        setTranscribing(false)
        if (trimmed) {
          lastFinalRef.current = trimmed
          if (shouldSubmitFinalRef.current) {
            submitFinalTranscript(trimmed)
          }
        }
      },
      onSTTError: (error) => {
        setRecording(false)
        setConnecting(false)
        setRecordingError(error.message)
        toast.error("Errore nel riconoscimento vocale: " + error.message)
      },
      onRecordingStart: () => {
        setRecording(true)
        setRecordingError(null)
        if (ttsSessionId && audioClientRef.current) {
          audioClientRef.current.controlBargeIn("pause", ttsSessionId)
        }
      },
      onRecordingStop: () => {
        setRecording(false)
        setTranscribing(false)
        setAudioLevel(0)
      },
      onAudioLevel: (level) => setAudioLevel(level),
    })

    return () => {
      client.close()
      audioClientRef.current = null
    }
  }, [mode, submitFinalTranscript, ttsSessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isStreaming) return
    onSubmit(message)
    setMessage("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }

    // Esc cancels streaming
    if (e.key === "Escape" && isStreaming) {
      e.preventDefault()
      onStop()
    }
  }

  // Voice Mode functions
  const startRecording = async () => {
    if (!audioClientRef.current) return

    setRecordingError(null)
    setConnecting(true)
    isHoldingRef.current = true
    shouldSubmitFinalRef.current = false
    lastFinalRef.current = null
    setMessage("")

    try {
      await audioClientRef.current.startRecording()
      setConnecting(false)
    } catch (err) {
      setConnecting(false)
      setRecording(false)
      shouldSubmitFinalRef.current = false
      isHoldingRef.current = false
      
      const error = err as Error
      let errorMsg = error.message || "Impossibile avviare la registrazione. Riprova."

      if (error.message?.includes("Permission")) {
        errorMsg = "Accesso al microfono negato. Consenti i permessi."
      } else if (error.message?.includes("NotFoundError")) {
        errorMsg = "Nessun microfono rilevato. Collega un microfono."
      } else if (error.message?.includes("WebSocket")) {
        errorMsg = "Connessione al servizio audio non riuscita. Controlla la rete."
      }

      setRecordingError(errorMsg)
      toast.error(errorMsg)
    }
  }

  const stopRecording = () => {
    if (audioClientRef.current) {
      audioClientRef.current.stopRecording()
    }
    isHoldingRef.current = false
    shouldSubmitFinalRef.current = true
    if (lastFinalRef.current) {
      submitFinalTranscript(lastFinalRef.current)
    }
  }

  const handlePushToTalk = (isPressed: boolean) => {
    if (isPressed && !recording && !isStreaming) {
      startRecording()
    } else if (!isPressed && recording) {
      stopRecording()
    }
  }

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

  // Text Mode UI
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
                <div className="flex items-center gap-2 ml-3 mb-3">
                  <Button
                    type="button"
                    onClick={() => setExpectAudio((v) => !v)}
                    aria-pressed={expectAudio}
                    className={cn(
                      "h-11 w-11 rounded-2xl flex items-center justify-center transition-colors",
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
                    className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-md hover:bg-destructive/90 mr-3 mb-3"
                    title="Interrompi"
                    aria-label="Interrompi"
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 mr-3 mb-3 flex items-center justify-center"
                    disabled={!message.trim()}
                    title="Invia"
                    aria-label="Invia"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Audio playback indicator */}
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

  // Voice Mode UI
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
          <div className="flex w-full flex-col gap-4 rounded-[24px] border border-border/60 bg-background/80 shadow-xl shadow-primary/5 backdrop-blur-md p-6">
            
            {/* Voice Controls */}
            <div className="flex flex-col items-center gap-4">
              {/* Main Recording Button - Push to Talk */}
              <Button
                type="button"
                onMouseDown={() => handlePushToTalk(true)}
                onMouseUp={() => handlePushToTalk(false)}
                onMouseLeave={() => handlePushToTalk(false)}
                disabled={connecting}
                className={cn(
                  "h-20 w-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
                  recording 
                    ? "bg-rose-600 text-white shadow-rose-600/30 scale-105" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                  connecting && "opacity-70 cursor-not-allowed"
                )}
                title={connecting ? "Connessione in corso..." : recording ? "Rilascia per fermare" : "Tieni premuto per parlare"}
                aria-label={connecting ? "Connessione in corso..." : recording ? "Rilascia per fermare" : "Tieni premuto per parlare"}
              >
                {connecting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {recording 
                    ? "Ascolto... rilascia per fermare" 
                    : "Tieni premuto il pulsante e parla"
                  }
                </p>
              </div>
            </div>

            {/* Voice Settings */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <div className="text-sm text-muted-foreground">
                Premi per parlare è sempre attivo. Rilascia per inviare.
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Volume2 className="h-4 w-4" />
                <span>La risposta vocale verrà riprodotta automaticamente.</span>
              </div>
            </div>

            {/* Transcription Display */}
            {message && (
              <div className="bg-muted/50 rounded-lg p-3 border border-border/30">
                <p className="text-sm text-foreground">{message}</p>
                {transcribing && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span>Trascrizione in corso...</span>
                  </div>
                )}
              </div>
            )}

            {/* Audio Level Visualization */}
            {recording && (
              <div className="flex items-center gap-2">
                <div className="flex items-end gap-1 h-4 flex-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-all duration-75",
                        audioLevel > (i + 1) * 5
                          ? "bg-rose-500"
                          : "bg-muted-foreground/30"
                      )}
                      style={{ height: `${Math.max(20, (i + 1) * 5)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {recordingError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{recordingError}</span>
                <button
                  onClick={() => setRecordingError(null)}
                  className="flex-shrink-0 hover:bg-destructive/20 rounded p-1 transition-colors"
                  aria-label="Chiudi errore"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Audio Playback Indicator */}
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
