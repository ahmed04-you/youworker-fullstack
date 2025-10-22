"use client"

import { useEffect, useRef } from "react"
import { Bot, User } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import { ChatMarkdown } from "@/components/chat/chat-markdown"

export function ChatTranscript() {
  const { messages, streamingText, isStreaming } = useChatContext()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      // Avoid smooth scrolling during fast token streaming to reduce jank
      scrollRef.current.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [messages, streamingText])

  return (
    <ScrollArea className="flex-1 h-full px-4 py-4 sm:px-6 lg:px-10" role="log" aria-live="polite" aria-label="Trascrizione chat">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 lg:max-w-5xl">
        {messages.map((msg, i) => {
          return (
            <div
              key={msg.id || i}
              className={cn("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start")}
              role="article"
              aria-label={`Messaggio ${msg.role === "user" ? "utente" : "assistente"}`}
            >
              {msg.role === "assistant" && (
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[84%] lg:max-w-[80%]",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {msg.role === "assistant" ? (
                  <ChatMarkdown content={msg.content} className="text-sm leading-relaxed text-foreground/90" />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarFallback className="bg-muted">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          )
        })}

        {isStreaming && (
          <div
            className="flex gap-4"
            role="status"
            aria-live="polite"
            aria-label="L'assistente sta scrivendo"
          >
            <Avatar className="h-8 w-8 border border-border/50">
              <AvatarFallback className="bg-primary/10">
                <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-3 sm:max-w-[84%] lg:max-w-[80%]">
              {streamingText && (
                <div className="flex items-start gap-2">
                  {/* For performance, render streaming text as plain text; parse markdown only for finalized messages */}
                  <p className="flex-1 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{streamingText}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={scrollRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  )
}
