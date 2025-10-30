'use client'

import { useChat } from '@/src/lib/hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { cn } from '@/src/lib/utils'

interface ChatViewProps {
  sessionId?: string
}

export function ChatView({ sessionId }: ChatViewProps) {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    isConnected,
  } = useChat(sessionId)

  return (
    <div className="h-full flex flex-col">
      {/* Header with connection status */}
      <div className="p-4 border-b border-[var(--color-glass-dark)]/30">
        <GlassCard variant="light" className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full transition-all',
                isConnected
                  ? 'bg-[#E32D21] shadow-[0_0_8px_rgba(227,45,33,0.6)] animate-pulse-red'
                  : 'bg-[#5A5566]'
              )} />
              <span className="text-sm text-white/70">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-[var(--color-glass-dark)]/30">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          disabled={!isConnected || isLoading}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
