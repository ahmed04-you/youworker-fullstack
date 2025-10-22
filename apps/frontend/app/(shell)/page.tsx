"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { ChatTranscript } from "@/components/chat/chat-transcript"
import { ChatComposer } from "@/components/chat/chat-composer"
import { useChatContext } from "@/lib/contexts/chat-context"
import { generateId } from "@/lib/utils"
import { useMode } from "@/lib/mode"
import { postVoiceTurn } from "@/lib/api"
import { playBase64Wav } from "@/lib/audio-utils"
import { SSEClient } from "@/lib/transport/sse-client"
import { Button } from "@/components/ui/button"
import { MessageSquare, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { RightPanel } from "@/components/shell/right-panel"
import { MobileToolSheet } from "@/components/shell/mobile-tool-sheet"
import type { ChatMessage } from "@/lib/types"

export default function ChatPage() {
  const {
    messages,
    streamingText,
    isStreaming,
    sessionId,
    expectAudio,
    setMessages,
    setStreamingText,
    setIsStreaming,
    addToolEvent,
    setMetadata,
    setAudioPlaying,
    ensureSession,
  } = useChatContext()

  const { mode, setMode } = useMode()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const tokenBufferRef = useRef("")
  const rafRef = useRef<number | null>(null)
  const sseClientRef = useRef<SSEClient | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  const flushTokens = () => {
    if (!tokenBufferRef.current) return
    const chunk = tokenBufferRef.current
    tokenBufferRef.current = ""
    setStreamingText((prev) => prev + chunk)
    rafRef.current = null
  }

  useEffect(() => {
    if (mode !== "text") {
      if (sseClientRef.current) {
        sseClientRef.current.close()
        sseClientRef.current = null
      }
      return
    }

    const client = new SSEClient()
    sseClientRef.current = client

    return () => {
      client.close()
      if (sseClientRef.current === client) {
        sseClientRef.current = null
      }
    }
  }, [mode, sessionId])

  const handleSubmit = async (content: string) => {
    if (mode !== "text" || !content.trim() || isStreaming) return

    // Append user message
    const userMessage = {
      role: "user" as const,
      content: content.trim(),
      id: generateId(),
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setStreamingText("")

    // Start streaming
    setIsStreaming(true)
    const activeSessionId = ensureSession()

    await handleTextModeSubmit([...messages, userMessage], activeSessionId)
  }

  const handleTextModeSubmit = async (history: ChatMessage[], sessionIdentifier: string) => {
    if (!sseClientRef.current) return

    try {
      await sseClientRef.current.open(
        { messages: history, session_id: sessionIdentifier, stream: true, enable_tools: true },
        {
          onToken: (data) => {
            tokenBufferRef.current += data.text
            if (rafRef.current == null) {
              rafRef.current = requestAnimationFrame(flushTokens)
            }
          },
          onTool: (data) => {
            addToolEvent({ event: "tool", data })
          },
          onLog: (data) => {
            if (data.level === "error") {
              toast.error(data.msg)
            } else if (data.level === "warn") {
              toast.warning(data.msg)
            } else {
              toast.info(data.msg)
            }
          },
          onHeartbeat: () => {
            // Heartbeat received, connection alive
          },
          onDone: async (data) => {
            flushTokens()
            const finalText = data.final_text || streamingText
            const assistantMessage = {
              role: "assistant" as const,
              content: finalText,
              id: generateId(),
              createdAt: new Date().toISOString(),
            }

            setMessages((prev) => [...prev, assistantMessage])
            setStreamingText("")
            setIsStreaming(false)
            setMetadata(data.metadata)

            // No TTS in text mode unless explicitly enabled
            if (expectAudio && finalText.trim()) {
              toast.info("Attiva la modalità voce per ascoltare la risposta")
            }

            setTimeout(() => {
              composerRef.current?.focus()
            }, 100)
          },
          onError: (error) => {
            setIsStreaming(false)
            setStreamingText("")
            toast.error(`Errore: ${error.message}`)
            setTimeout(() => {
              composerRef.current?.focus()
            }, 100)
          },
        }
      )
    } catch (error) {
      setIsStreaming(false)
      setStreamingText("")
      toast.error("Impossibile avviare lo streaming di testo")
    }
  }

  const handleVoiceTurn = async ({ audioBase64, sampleRate }: { audioBase64: string; sampleRate: number }) => {
    if (isStreaming) {
      throw new Error("Una risposta è già in corso. Attendi il completamento precedente.")
    }

    tokenBufferRef.current = ""
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    setStreamingText("")
    setIsStreaming(true)
    const activeSessionId = ensureSession()

    try {
      const response = await postVoiceTurn({
        messages,
        audio_b64: audioBase64,
        sample_rate: sampleRate,
        expect_audio: expectAudio,
        enable_tools: true,
        session_id: activeSessionId,
      })

      const transcript = (response.transcript || "").trim()
      const assistantText = response.assistant_text || ""
      const now = new Date().toISOString()

      const userMessage: ChatMessage = {
        role: "user",
        content: transcript,
        id: generateId(),
        createdAt: now,
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantText,
        id: generateId(),
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setMetadata(response.metadata || {})
      setStreamingText("")
      setIsStreaming(false)

      if (Array.isArray(response.tool_events)) {
        response.tool_events.forEach((event) => {
          addToolEvent({ event: "tool", data: event })
        })
      }

      if (Array.isArray(response.logs)) {
        response.logs.forEach((log) => {
          if (!log?.msg) return
          if (log.level === "error") {
            toast.error(log.msg)
          } else if (log.level === "warn") {
            toast.warning(log.msg)
          }
        })
      }

      if (audioElementRef.current) {
        try {
          audioElementRef.current.pause()
        } catch {
          // ignore
        }
        audioElementRef.current = null
      }

      if (expectAudio && response.audio_b64) {
        try {
          setAudioPlaying(true)
          const audioEl = await playBase64Wav(response.audio_b64)
          audioElementRef.current = audioEl
          audioEl.addEventListener(
            "ended",
            () => {
              setAudioPlaying(false)
            },
            { once: true },
          )
          audioEl.addEventListener(
            "error",
            () => {
              setAudioPlaying(false)
            },
            { once: true },
          )
        } catch (err) {
          setAudioPlaying(false)
          toast.error("Riproduzione audio non riuscita.")
        }
      } else {
        setAudioPlaying(false)
      }

      setTimeout(() => {
        composerRef.current?.focus()
      }, 100)

      return transcript
    } catch (error) {
      setIsStreaming(false)
      setStreamingText("")
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error(err.message || "Errore durante la richiesta vocale.")
      throw err
    }
  }

  const handleStop = () => {
    if (sseClientRef.current) {
      sseClientRef.current.close()
    }
    setIsStreaming(false)
    flushTokens()
    setStreamingText("")

    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause()
      } catch {
        // ignore
      }
      audioElementRef.current = null
      setAudioPlaying(false)
    }

    setTimeout(() => {
      composerRef.current?.focus()
    }, 100)
  }

  const handleModeToggle = async (newMode: "text" | "voice") => {
    if (isStreaming) {
      toast.error("Impossibile cambiare modalità durante una risposta in corso")
      return
    }
    if (mode === newMode) {
      return
    }
    setMode(newMode)
  }

  return (
    <div className="flex h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-border/50 bg-background/70 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
            <h1 className="text-lg font-semibold">YouWorker.AI</h1>
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeToggle("text")}
                className={cn(
                  "flex items-center gap-2 rounded-xl",
                  mode === "text" && "bg-primary text-primary-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Testo
              </Button>

              <Button
                variant={mode === "voice" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeToggle("voice")}
                className={cn(
                  "flex items-center gap-2 rounded-xl",
                  mode === "voice" && "bg-primary text-primary-foreground"
                )}
              >
                <Mic className="h-4 w-4" />
                Voce
              </Button>
            </div>
          </div>
        </div>

        {isStreaming && (
          <div className="mx-4 mt-3 sm:mx-6 lg:mx-10" aria-live="polite" role="status">
            <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/40 px-4 py-2 text-xs text-muted-foreground shadow-sm">
              <div className="h-2 w-2 rounded-full bg-primary/80" />
              <span>Sto analizzando le informazioni per offrirti la risposta migliore…</span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatTranscript />
        </div>

        <ChatComposer
          onSubmit={handleSubmit}
          onStop={handleStop}
          onVoiceTurn={handleVoiceTurn}
          textareaRef={composerRef}
        />
      </div>
      <RightPanel />
      <MobileToolSheet />
    </div>
  )
}
