"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { Send, Square, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spotlight } from "@/components/aceternity/spotlight"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useComposerContext } from "@/lib/contexts/composer-context"
import { cn } from "@/lib/utils"

interface ChatComposerProps {
  onSubmit: (content: string) => void
  onStop: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

const MAX_TEXTAREA_HEIGHT = 200

export function ChatComposer({ onSubmit, onStop, textareaRef }: ChatComposerProps) {
  const { isStreaming, enableTools, setEnableTools, suggestedPrompt, setSuggestedPrompt } = useChatContext()
  const { registerComposer } = useComposerContext()
  const [message, setMessage] = useState("")
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useMemo(() => textareaRef ?? localTextareaRef, [textareaRef])

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

  useEffect(() => {
    if (!isStreaming) {
      composerRef.current?.focus()
    }
  }, [isStreaming, composerRef])

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
              placeholder="Chiedi qualsiasi cosa a YouWorker.AI..."
              className="min-h-[96px] w-full resize-none rounded-3xl border border-border/60 bg-background px-5 py-4 text-sm shadow-inner transition-[border-color,box-shadow] focus:border-primary/60 focus-visible:ring-0"
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                onClick={() => setEnableTools((prev) => !prev)}
                aria-pressed={enableTools}
                className={cn(
                  "h-11 rounded-2xl px-5 text-sm font-semibold transition-colors ml-3 mb-3",
                  enableTools
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {enableTools ? "Tool abilitati" : "Tool disabilitati"}
              </Button>
              {isStreaming ? (
                <Button
                  type="button"
                  onClick={onStop}
                  variant="destructive"
                  className="h-11 rounded-2xl px-5 text-sm font-semibold shadow-md hover:bg-destructive/90 mr-3 mb-3"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Interrompi
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 mr-3 mb-3"
                  disabled={!message.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Invia
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.form>
    </div>
  )
}
