"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { ChatTranscript } from "@/components/chat/chat-transcript"
import { ChatComposer } from "@/components/chat/chat-composer"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useStreamingChat } from "@/lib/hooks"
import { generateId } from "@/lib/utils"

export default function ChatPage() {
  const {
    messages,
    streamingText,
    isStreaming,
    sessionId,
    enableTools,
    setMessages,
    setStreamingText,
    setIsStreaming,
    addToolEvent,
    setMetadata,
  } = useChatContext()

  const { start, stop, lastError } = useStreamingChat()
  const composerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (lastError) {
      toast.error(`Errore di streaming: ${lastError.message}`)
    }
  }, [lastError])

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

    await start(
      [...messages, userMessage],
      {
        onToken: (data) => {
          // Append token delta to streaming text
          setStreamingText((prev) => prev + data.text)
        },
        onTool: (data) => {
          // Add tool event with animation
          addToolEvent({ event: "tool", data })
        },
        onLog: (data) => {
          // Show log as toast based on level
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
        onDone: (data) => {
          // Commit streaming text as final assistant message
          const assistantMessage = {
            role: "assistant" as const,
            content: data.final_text || streamingText,
            id: generateId(),
            createdAt: new Date().toISOString(),
          }

          setMessages((prev) => [...prev, assistantMessage])
          setStreamingText("")
          setIsStreaming(false)
          setMetadata(data.metadata)

          // Restore focus to composer
          setTimeout(() => {
            composerRef.current?.focus()
          }, 100)
        },
        onError: (error) => {
          setIsStreaming(false)
          setStreamingText("")
          toast.error(`Errore: ${error.message}`)

          // Restore focus to composer
          setTimeout(() => {
            composerRef.current?.focus()
          }, 100)
        },
      },
      sessionId,
    )
  }

  const handleStop = () => {
    stop()
    setIsStreaming(false)
    setStreamingText("")

    // Restore focus to composer
    setTimeout(() => {
      composerRef.current?.focus()
    }, 100)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 min-h-0">
        <ChatTranscript />
      </div>
      <ChatComposer onSubmit={handleSubmit} onStop={handleStop} textareaRef={composerRef} />
    </motion.div>
  )
}
