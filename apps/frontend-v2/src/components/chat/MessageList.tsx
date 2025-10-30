'use client'

import { useEffect, useRef } from 'react'
import { MessageItem } from './MessageItem'
import { StreamingMessage } from './StreamingMessage'
import { Loader2, MessageSquare } from 'lucide-react'
import type { Message } from '@/src/lib/types'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-6 space-y-6"
    >
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#E32D21]/20 to-[#454055]/40 flex items-center justify-center backdrop-blur-[16px] border border-[var(--color-glass-red)] shadow-[var(--shadow-glass-red)]">
              <MessageSquare className="w-8 h-8 text-[#F04438]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Start a conversation
              </h3>
              <p className="text-white/50">
                Ask me anything or upload documents to get started
              </p>
            </div>
          </div>
        </div>
      )}

      {messages.map((message, index) => {
        const isStreaming = message.role === 'assistant' && index === messages.length - 1 && isLoading

        return isStreaming ? (
          <StreamingMessage key={message.id} message={message} />
        ) : (
          <MessageItem key={message.id} message={message} />
        )
      })}

      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
