'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Message } from '@/src/lib/types'
import { Bot, Loader2 } from 'lucide-react'

interface StreamingMessageProps {
  message: Message
}

export function StreamingMessage({ message }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-slate">
        <Bot className="w-4 h-4 text-white" />
      </div>

      {/* Message content */}
      <div className="flex-1 max-w-[70%] flex flex-col gap-1">
        <GlassCard variant="card" className="p-3">
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          {/* Typing indicator */}
          <div className="flex items-center gap-1 mt-2">
            <Loader2 className="w-3 h-3 text-[#E32D21] animate-spin" />
            <span className="text-xs text-white/50">Typing...</span>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
