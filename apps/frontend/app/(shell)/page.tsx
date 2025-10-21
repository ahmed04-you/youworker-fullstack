"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { ChatTranscript } from "@/components/chat/chat-transcript"
import { ChatComposer } from "@/components/chat/chat-composer"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useStreamingChat } from "@/lib/hooks"
import { generateId } from "@/lib/utils"
import { StreamingPlayer } from "@/lib/audio"

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
  } = useChatContext()

  const { start, stop, lastError } = useStreamingChat()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const tokenBufferRef = useRef("")
  const rafRef = useRef<number | null>(null)

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
          // Batch token updates to reduce re-renders
          tokenBufferRef.current += data.text
          if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(flushTokens)
          }
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
        onDone: async (data) => {
          // Commit streaming text as final assistant message
          // Flush any buffered tokens before committing
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

          // Optional audio playback of the response
          if (expectAudio && finalText.trim()) {
            try {
              const base = process.env.NEXT_PUBLIC_AUDIO_BASE_URL || "http://localhost:7006"
              const mcpUrl = base.replace(/^http/, "ws") + "/mcp"
              const ws = new WebSocket(mcpUrl)
              await new Promise<void>((resolve, reject) => {
                ws.onopen = () => resolve()
                ws.onerror = (e) => reject(e)
              })
              let rid = 0
              const rpc = (method: string, params: any) => {
                return new Promise<any>((resolve) => {
                  const id = ++rid
                  const handler = (ev: MessageEvent) => {
                    const msg = JSON.parse(ev.data)
                    if (msg.id === id) {
                      ws.removeEventListener("message", handler)
                      resolve(msg.result?.content?.[0]?.json || msg.result)
                    }
                  }
                  ws.addEventListener("message", handler)
                  ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }))
                })
              }
              await rpc("initialize", { capabilities: { tools: { list: true, call: true } } })
              const s1 = await rpc("tools/call", { name: "audio.input.stream", arguments: { sample_rate: 24000, frame_ms: 20 } })
              const sid = s1.session_id
              const s2 = await rpc("tools/call", { name: "tts.stream.synthesize", arguments: { session_id: sid, sample_rate: 24000 } })
              ws.close()
              const ttsUrl = base.replace(/^http/, "ws") + s2.tts_ws_url
              const tts = new WebSocket(ttsUrl)
              const player = new StreamingPlayer(24000)
              tts.onopen = () => {
                tts.send(JSON.stringify({ type: "synthesize", text: finalText }))
              }
              tts.onmessage = async (ev) => {
                const msg = JSON.parse(ev.data)
                if (msg.type === "audio_chunk" && msg.audio_chunk) {
                  const b = Uint8Array.from(atob(msg.audio_chunk), (c) => c.charCodeAt(0)).buffer
                  await player.playChunk(b)
                }
                if (msg.type === "done") {
                  tts.close()
                  player.close()
                }
              }
            } catch (err) {
              // TTS playback failed silently
            }
          }

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
    // Flush any pending tokens into the streaming state before clearing
    flushTokens()
    setStreamingText("")

    // Restore focus to composer
    setTimeout(() => {
      composerRef.current?.focus()
    }, 100)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 min-h-0">
        <ChatTranscript />
      </div>
      <ChatComposer onSubmit={handleSubmit} onStop={handleStop} textareaRef={composerRef} />
    </div>
  )
}
