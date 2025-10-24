"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Send, Square, Mic, Volume2, Loader2, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spotlight } from "@/components/aceternity/spotlight"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useComposerContext } from "@/lib/contexts/composer-context"
import { cn } from "@/lib/utils"
import { useChatSettings } from "@/lib/mode"
import { useVoiceRecording } from "@/hooks/use-voice-recording"

interface ChatComposerProps {
  onSubmit: (content: string) => void
  onStop: () => void
  onVoiceTurn?: (args: { audioBase64: string; sampleRate: number }) => Promise<string | void>
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

const MAX_TEXTAREA_HEIGHT = 200

export function ChatComposer({ onSubmit, onStop, onVoiceTurn, textareaRef }: ChatComposerProps) {
  const {
    isStreaming,
    audioPlaying,
    suggestedPrompt,
    setSuggestedPrompt,
  } = useChatContext()
  const { expectAudio, setExpectAudio } = useChatSettings()
  const { registerComposer } = useComposerContext()
  
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = textareaRef ?? localTextareaRef

  const {
    recording,
    connecting,
    processing,
    recordingError,
    audioLevel,
    lastTranscript,
    buttonDisabled,
    handlePressStart,
    handlePressEnd,
    handleButtonClick,
    clearError,
    clearTranscript,
  } = useVoiceRecording({ onVoiceTurn, isStreaming })

  const [message, setMessage] = useState("")

  const adjustTextareaHeight = useCallback(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = "auto"
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden"
  }, [composerRef])

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
    adjustTextareaHeight()
  }, [message, adjustTextareaHeight])

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
          <div className="flex w-full flex-col gap-4 rounded-[24px] border border-border/60 bg-background/80 shadow-xl shadow-primary/5 backdrop-blur-md">
            {/* Text input area */}
            <div className="px-6 pt-6">
              <Textarea
                ref={composerRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi il tuo messaggio o usa il pulsante vocale..."
                className="min-h-[96px] w-full resize-none rounded-3xl border border-border/60 bg-background px-5 py-4 text-sm shadow-inner transition-[border-color,box-shadow] focus:border-primary/60 focus-visible:ring-0"
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
              />
            </div>

            {/* Voice input instructions */}
            <div className="px-6 pb-2">
              <p className="text-center text-sm text-muted-foreground">
                {recording
                  ? "Ascolto... rilascia per fermare"
                  : buttonDisabled
                    ? "Attendi il completamento della risposta"
                    : "Tieni premuto il pulsante microfono e parla"}
              </p>
            </div>

            {/* Controls and status */}
            <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setExpectAudio((v) => !v)}
                  aria-pressed={expectAudio}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                    expectAudio ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                  title={expectAudio ? "Risposta con audio" : "Risposta solo testo"}
                  aria-label={expectAudio ? "Risposta con audio" : "Risposta solo testo"}
                >
                  <Volume2 className="h-5 w-5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {expectAudio ? "Risposta con audio" : "Risposta solo testo"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Mic button with same styling as send button */}
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
                    "flex h-11 w-11 items-center justify-center rounded-2xl shadow-md transition-all duration-200",
                    recording
                      ? "bg-rose-600 text-white shadow-rose-600/30 hover:bg-rose-600/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
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
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={onStop}
                    variant="destructive"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md hover:bg-destructive/90"
                    title="Interrompi"
                    aria-label="Interrompi"
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                    disabled={!message.trim() || recording}
                    title="Invia"
                    aria-label="Invia"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Status indicators */}
            {lastTranscript && (
              <div className="mx-6 mb-4 rounded-lg border border-border/30 bg-muted/50 p-3">
                <p className="text-sm text-foreground">{lastTranscript}</p>
              </div>
            )}

            {(processing || isStreaming) && (
              <div className="mx-6 mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Elaborazione della richiesta...</span>
              </div>
            )}

            {recording && (
              <div className="mx-6 mb-4 flex items-center gap-2">
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
              <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{recordingError}</span>
                <button
                  onClick={clearError}
                  className="flex-shrink-0 rounded p-1 transition-colors hover:bg-destructive/20"
                  aria-label="Chiudi errore"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {audioPlaying && (
              <div className="mx-6 mb-4 flex items-center gap-2 text-sm text-primary">
                <Volume2 className="h-4 w-4 animate-pulse" />
                <span>Riproduzione risposta audio...</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
