"use client"

import { useEffect, useRef } from "react"
import { Bot, User, MessageSquare, Copy, RefreshCw, Pencil, MoreHorizontal } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import type { ChatMessage } from "@/lib/types"

interface ChatTranscriptProps {
  onCopyMessage?: (message: ChatMessage, index: number) => void
  onRegenerateMessage?: (message: ChatMessage, index: number) => void
  onEditMessage?: (message: ChatMessage, index: number) => void
  editingMessageId?: string | null
}

export function ChatTranscript({
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  editingMessageId,
}: ChatTranscriptProps) {
  const { messages, streamingText, isStreaming } = useChatContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (scrollRef.current) {
      // Avoid smooth scrolling during fast token streaming to reduce jank
      scrollRef.current.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [messages, streamingText])

  const showEmptyState = messages.length === 0 && !isStreaming && !streamingText

  return (
    <ScrollArea className="flex-1 h-full px-4 py-4 sm:px-6 lg:px-10" role="log" aria-live="polite" aria-label={t("chat.title")}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 lg:max-w-5xl">
        {showEmptyState ? (
          <Empty className="border border-border/40 bg-background/60">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("chat.empty.title")}</EmptyTitle>
              <EmptyDescription>{t("chat.empty.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <p className="text-xs text-muted-foreground">{t("chat.placeholder.examples")}</p>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isUser = msg.role === "user"
              const ariaLabel = isUser ? t("chat.message.user") : t("chat.message.assistant")
              const isEditing = editingMessageId === msg.id

              return (
                <div
                  key={msg.id || i}
                  className={cn("flex gap-4", isUser ? "justify-end" : "justify-start")}
                  role="article"
                  aria-label={ariaLabel}
                >
                  {!isUser && (
                    <Avatar className="h-8 w-8 border border-border/50">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="relative flex max-w-[90%] flex-col sm:max-w-[84%] lg:max-w-[80%] group">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3",
                        isUser ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <ChatMarkdown content={msg.content} className="text-sm leading-relaxed text-foreground/90" />
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <MessageActions
                      message={msg}
                      index={i}
                      isUser={isUser}
                      isEditing={isEditing}
                      onCopy={onCopyMessage}
                      onRegenerate={onRegenerateMessage}
                      onEdit={onEditMessage}
                      translate={t}
                    />
                    {isEditing && (
                      <span className="mt-1 text-xs font-medium text-primary">{t("chat.actions.editing")}</span>
                    )}
                  </div>
                  {isUser && (
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
                aria-label={t("chat.message.assistant")}
              >
                <Avatar className="h-8 w-8 border border-border/50">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-3 sm:max-w-[84%] lg:max-w-[80%]">
                  {streamingText && (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{streamingText}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div ref={scrollRef} aria-hidden="true" />
      </div>
    </ScrollArea>
  )
}

interface MessageActionsProps {
  message: ChatMessage
  index: number
  isUser: boolean
  isEditing: boolean
  onCopy?: (message: ChatMessage, index: number) => void
  onRegenerate?: (message: ChatMessage, index: number) => void
  onEdit?: (message: ChatMessage, index: number) => void
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string
}

function MessageActions({
  message,
  index,
  isUser,
  isEditing,
  onCopy,
  onRegenerate,
  onEdit,
  translate,
}: MessageActionsProps) {
  const hasCopy = typeof onCopy === "function"
  const hasRegenerate = !isUser && typeof onRegenerate === "function"
  const hasEdit = isUser && typeof onEdit === "function"

  if (!hasCopy && !hasRegenerate && !hasEdit) {
    return null
  }

  return (
    <div className="absolute -top-10 right-0 flex items-center gap-1 rounded-full bg-background/80 p-1 text-xs shadow-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={translate("chat.actions.more")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-44">
          {hasCopy && (
            <DropdownMenuItem
              onClick={() => onCopy?.(message, index)}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              <span>{translate("chat.actions.copy")}</span>
            </DropdownMenuItem>
          )}
          {hasRegenerate && (
            <DropdownMenuItem
              onClick={() => onRegenerate?.(message, index)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{translate("chat.actions.regenerate")}</span>
            </DropdownMenuItem>
          )}
          {hasEdit && (
            <DropdownMenuItem
              onClick={() => onEdit?.(message, index)}
              disabled={isEditing}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              <span>{translate("chat.actions.edit")}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
