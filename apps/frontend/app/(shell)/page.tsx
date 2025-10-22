"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ChatTranscript } from "@/components/chat/chat-transcript"
import { ChatComposer } from "@/components/chat/chat-composer"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useStreamingChat, useHealthSWR } from "@/lib/hooks"
import { generateId } from "@/lib/utils"
import { stripMarkdownForSpeech } from "@/lib/markdown-utils"
import { useMode } from "@/lib/mode"
import { SSEClient } from "@/lib/transport/sse-client"
import { AudioWSClient } from "@/lib/transport/audio-ws-client"
import { Button } from "@/components/ui/button"
import { MessageSquare, Mic, Plus, Upload, History, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import { IngestSheet } from "@/components/shell/ingest-sheet"

const NAV_ITEMS = [
  {
    label: "Chat",
    href: "/",
    icon: MessageSquare,
  },
  {
    label: "Cronologia",
    href: "/history",
    icon: History,
  },
  {
    label: "Impostazioni",
    href: "/settings",
    icon: Settings,
  },
] as const

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
    setTtsSessionId,
    ensureSession,
    clearChat,
  } = useChatContext()

  const { mode, setMode } = useMode()
  const { start, stop, lastError } = useStreamingChat()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const [ingestOpen, setIngestOpen] = useState(false)
  const { data: health, error: healthError } = useHealthSWR()
  const tokenBufferRef = useRef("")
  const rafRef = useRef<number | null>(null)
  const sseClientRef = useRef<SSEClient | null>(null)
  const audioClientRef = useRef<AudioWSClient | null>(null)
  const statusBadgeClasses = cn(
    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    healthError ? "border-rose-500/30 bg-rose-500/10 text-rose-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  )
  const statusText = healthError ? "API offline" : health ? "API online" : "Verifica API…"

  const handleNewChat = () => {
    clearChat()
    if (pathname !== "/") {
      router.push("/")
    }
    setTimeout(() => {
      composerRef.current?.focus()
    }, 100)
  }

  const flushTokens = () => {
    if (!tokenBufferRef.current) return
    const chunk = tokenBufferRef.current
    tokenBufferRef.current = ""
    setStreamingText((prev) => prev + chunk)
    rafRef.current = null
  }

  useEffect(() => {
    if (lastError) {
      toast.error(`Errore di streaming: ${lastError.message}`)
    }
  }, [lastError])

  // Initialize transport clients based on mode
  useEffect(() => {
    if (mode === "text") {
      sseClientRef.current = new SSEClient()
    } else {
      audioClientRef.current = new AudioWSClient(24000)
    }

    return () => {
      // Cleanup on mode change or unmount
      if (sseClientRef.current) {
        sseClientRef.current.close()
        sseClientRef.current = null
      }
      if (audioClientRef.current) {
        audioClientRef.current.close()
        audioClientRef.current = null
      }
    }
  }, [mode, sessionId])

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isStreaming) return

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

    if (mode === "text") {
      // Use SSE for text mode
      await handleTextModeSubmit([...messages, userMessage], activeSessionId)
    } else {
      // Use existing streaming chat for voice mode (TTS will be handled separately)
      await handleVoiceModeSubmit([...messages, userMessage], activeSessionId)
    }
  }

  const handleTextModeSubmit = async (messages: any[], sessionIdentifier: string) => {
    if (!sseClientRef.current) return

    try {
      await sseClientRef.current.open(
        { messages, session_id: sessionIdentifier, stream: true, enable_tools: true },
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

  const handleVoiceModeSubmit = async (messages: any[], sessionIdentifier: string) => {
    // Use existing streaming chat for the agent loop, but handle TTS separately
    await start(
      messages,
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

          // Play audio response in voice mode
          if (expectAudio && finalText.trim() && audioClientRef.current) {
            try {
              await audioClientRef.current.openTTS({
                onTTSConnect: () => {
                  setTtsSessionId(audioClientRef.current?.ttsSession || null)
                  setAudioPlaying(true)
                },
                onTTSDone: () => {
                  setAudioPlaying(false)
                },
                onTTSError: (error) => {
                  console.error("TTS error:", error)
                  setAudioPlaying(false)
                },
              })

              // Strip markdown for speech
              const speechText = stripMarkdownForSpeech(finalText)
              audioClientRef.current.sendSynthesize(speechText)
            } catch (err) {
              console.error("TTS playback failed:", err)
              setAudioPlaying(false)
            }
          }
        },
        onError: (error) => {
          setIsStreaming(false)
          setStreamingText("")
          toast.error(`Errore: ${error.message}`)
        },
      },
      sessionIdentifier,
    )
  }

  const handleStop = () => {
    stop()
    setIsStreaming(false)
    flushTokens()
    setStreamingText("")

    // Also stop any active audio
    if (audioClientRef.current) {
      audioClientRef.current.controlBargeIn("cancel")
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">YouWorker.AI</h1>
              <div className="flex flex-wrap items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Button
                      key={item.href}
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => router.push(item.href)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            <span className={statusBadgeClasses}>
              <span className={cn(
                "inline-flex h-2 w-2 rounded-full",
                healthError ? "bg-rose-500" : "bg-emerald-500",
              )} />
              {statusText}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-2 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Nuova chat
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIngestOpen(true)}
                className="flex items-center gap-2 rounded-xl"
              >
                <Upload className="h-4 w-4" />
                Carica file
              </Button>
            </div>

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
      </div>

      <div className="flex-1 min-h-0">
        <ChatTranscript />
      </div>
      
      <ChatComposer 
        onSubmit={handleSubmit} 
        onStop={handleStop} 
        textareaRef={composerRef} 
      />
      <IngestSheet open={ingestOpen} onOpenChange={setIngestOpen} />
    </div>
  )
}
