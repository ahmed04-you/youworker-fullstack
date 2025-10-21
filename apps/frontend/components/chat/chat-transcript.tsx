"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Bot, User } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { ChatMarkdown } from "@/components/chat/chat-markdown"

export function ChatTranscript() {
  const { messages, streamingText, isStreaming } = useChatContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useMotionPreference()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [messages, streamingText])

  return (
    <ScrollArea className="flex-1 h-full px-4 py-4 sm:px-6 lg:px-10" role="log" aria-live="polite" aria-label="Trascrizione chat">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 lg:max-w-5xl">
        {messages.map((msg, i) => {
          const Container = prefersReducedMotion ? "div" : motion.div

          return (
            <Container
              key={msg.id || i}
              {...(!prefersReducedMotion && {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.05 },
              })}
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
            </Container>
          )
        })}

        {isStreaming && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
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
              {streamingText ? (
                <div className="flex items-start gap-2">
                  <ChatMarkdown content={streamingText} className="flex-1 text-sm leading-relaxed text-foreground/90" />
                  {!prefersReducedMotion && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
                      className="mt-1 inline-block h-4 w-[2px] flex-shrink-0 bg-primary"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1" role="status" aria-label="Caricamento della risposta">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="h-2.5 w-2.5 rounded-full bg-primary/80"
                      animate={
                        prefersReducedMotion
                          ? {}
                          : {
                              opacity: [0.3, 1, 0.3],
                              y: [0, -3, 0],
                            }
                      }
                      transition={
                        prefersReducedMotion
                          ? {}
                          : {
                              duration: 0.9,
                              repeat: Number.POSITIVE_INFINITY,
                              ease: "easeInOut",
                              delay: dot * 0.18,
                            }
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  )
}
