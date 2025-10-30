'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Message } from '@/src/lib/types'
import { formatTimestamp } from '@/src/lib/utils'
import { User, Bot } from 'lucide-react'

interface MessageItemProps {
  message: Message
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-gradient-brand'
          : 'bg-gradient-slate'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <GlassCard variant="card" className="p-3">
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </GlassCard>
        <span className="text-xs text-white/40 px-2">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
