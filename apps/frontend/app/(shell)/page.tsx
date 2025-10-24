"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ChatTranscript } from "@/components/chat/chat-transcript"
import { ChatComposer } from "@/components/chat/chat-composer-refactored"
import { useChatContext } from "@/lib/contexts/chat-context"
import { generateId } from "@/lib/utils"
import { useChatSettings } from "@/lib/mode"
import { streamChat, type StreamController } from "@/lib/sse"
import { playBase64Wav } from "@/lib/audio-utils"
import { Button } from "@/components/ui/button"
import { MessageSquare, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { RightPanel } from "@/components/shell/right-panel"
import { MobileToolSheet } from "@/components/shell/mobile-tool-sheet"
import type { ChatMessage } from "@/lib/types"
import { useI18n } from "@/lib/i18n"

export default function ChatPage() {
  const {
    messages,
    streamingText,
    isStreaming,
    sessionId,
    setMessages,
    setStreamingText,
    setIsStreaming,
    addToolEvent,
    setMetadata,
    setAudioPlaying,
    setSuggestedPrompt,
    ensureSession,
  } = useChatContext()

  const { expectAudio, setExpectAudio, assistantLanguage } = useChatSettings()
  const { t } = useI18n()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const tokenBufferRef = useRef("")
  const rafRef = useRef<number | null>(null)
  const streamControllerRef = useRef<StreamController | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

  const flushTokens = useCallback(() => {
    if (!tokenBufferRef.current) return
    const chunk = tokenBufferRef.current
    tokenBufferRef.current = ""
    setStreamingText((prev) => prev + chunk)
    rafRef.current = null
  }, [setStreamingText])

  useEffect(() => {
    return () => {
      streamControllerRef.current?.close()
      streamControllerRef.current = null
    }
  }, [sessionId])

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
    setEditingMessageId(null)

    // Start streaming
    setIsStreaming(true)
    const activeSessionId = ensureSession()

    await handleUnifiedChatSubmit([...messages, userMessage], activeSessionId, content.trim(), null)
  }

  const handleUnifiedChatSubmit = useCallback(
    async (
      history: ChatMessage[],
      sessionIdentifier: string,
      textInput: string | null,
      audioBase64: string | null,
    ) => {
      try {
        streamControllerRef.current?.close()
        streamControllerRef.current = null

        const controller = await streamChat(
          {
            messages: history.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            text_input: textInput,
            audio_b64: audioBase64,
            expect_audio: expectAudio,
            assistant_language: assistantLanguage,
            enable_tools: true,
            session_id: sessionIdentifier,
            stream: true,
          } as const,
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
              streamControllerRef.current = null
              flushTokens()
              const finalText = data.content || data.final_text || streamingText
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

              if (data.audio_b64 && expectAudio) {
                try {
                  setAudioPlaying(true)
                  const audioEl = await playBase64Wav(data.audio_b64)
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
            },
            onError: (error) => {
              streamControllerRef.current = null
              setIsStreaming(false)
              setStreamingText("")
              toast.error(`Errore: ${error.message}`)
              setTimeout(() => {
                composerRef.current?.focus()
              }, 100)
            },
          },
        )
        streamControllerRef.current = controller
      } catch (error) {
        streamControllerRef.current?.close()
        streamControllerRef.current = null
        setIsStreaming(false)
        setStreamingText("")
        toast.error("Impossibile avviare lo streaming di testo")
      }
    },
    [
      addToolEvent,
      assistantLanguage,
      expectAudio,
      flushTokens,
      setAudioPlaying,
      setIsStreaming,
      setMetadata,
      setMessages,
      setStreamingText,
      streamingText,
    ],
  )

  const handleVoiceTurn = async ({ audioBase64, sampleRate }: { audioBase64: string; sampleRate: number }) => {
    if (isStreaming) {
      throw new Error(t("chat.error.busy"))
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
      // Use the unified chat endpoint
      await handleUnifiedChatSubmit(messages, activeSessionId, null, audioBase64)
      
      setTimeout(() => {
        composerRef.current?.focus()
      }, 100)
    } catch (error) {
      setIsStreaming(false)
      setStreamingText("")
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error(err.message || t("composer.voice.error"))
      throw err
    }
  }

  const resetStreamingState = useCallback(
    (options: { closeStream?: boolean } = {}) => {
      if (options.closeStream !== false && sseClientRef.current) {
        sseClientRef.current.close()
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      tokenBufferRef.current = ""
      setIsStreaming(false)
      setStreamingText("")

      if (audioElementRef.current) {
        try {
          audioElementRef.current.pause()
        } catch (error) {
          console.warn("Failed to pause audio", error)
        }
        audioElementRef.current = null
      }
      setAudioPlaying(false)
    },
    [setAudioPlaying, setIsStreaming, setStreamingText],
  )

  const handleStop = () => {
    resetStreamingState()
    flushTokens()
    setTimeout(() => {
      composerRef.current?.focus()
    }, 100)
  }

  const handleCopyMessage = useCallback(
    async (message: ChatMessage) => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(message.content)
          toast.success(t("toast.copied"))
        } else {
          throw new Error("Clipboard API unavailable")
        }
      } catch (error) {
        console.error("Failed to copy message", error)
        toast.error(t("chat.actions.error.clipboard"))
      }
    },
    [t],
  )

  const handleRegenerateMessage = useCallback(
    (message: ChatMessage, index: number) => {
      const history = messages.slice(0, index)
      const lastUserMessage = [...history].reverse().find((item) => item.role === "user")

      if (!lastUserMessage) {
        toast.error(t("chat.actions.error.no_user"))
        return
      }

      resetStreamingState()
      setMessages(history)
      setIsStreaming(true)
      setEditingMessageId(null)
      toast.info(t("toast.regenerating"))

      const activeSessionId = ensureSession()
      void handleUnifiedChatSubmit(history, activeSessionId, lastUserMessage.content, null)
    },
    [ensureSession, handleUnifiedChatSubmit, messages, resetStreamingState, setIsStreaming, setMessages, t],
  )

  const handleEditMessage = useCallback(
    (message: ChatMessage, index: number) => {
      if (message.role !== "user") {
        return
      }

      const history = messages.slice(0, index)
      resetStreamingState({ closeStream: false })
      setMessages(history)
      setIsStreaming(false)
      setSuggestedPrompt(message.content)
      setEditingMessageId(message.id)
      toast.info(t("chat.actions.editing"))
      setTimeout(() => composerRef.current?.focus(), 100)
    },
    [messages, resetStreamingState, setIsStreaming, setMessages, setSuggestedPrompt, t],
  )


  return (
    <div className="flex h-full">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-border/50 bg-background/70 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
            <h1 className="text-lg font-semibold">{t("chat.title")}</h1>
          </div>
        </div>

        {isStreaming && (
          <div className="mx-4 mt-3 sm:mx-6 lg:mx-10" aria-live="polite" role="status">
            <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/40 px-4 py-2 text-xs text-muted-foreground shadow-sm">
              <div className="h-2 w-2 rounded-full bg-primary/80" />
              <span>{t("chat.status.analyzing")}</span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatTranscript
            onCopyMessage={handleCopyMessage}
            onRegenerateMessage={handleRegenerateMessage}
            onEditMessage={handleEditMessage}
            editingMessageId={editingMessageId}
          />
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
