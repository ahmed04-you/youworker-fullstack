'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { Send, Paperclip, Mic } from 'lucide-react'
import { cn } from '@/src/lib/utils'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (message: string) => void
  disabled?: boolean
  loading?: boolean
}

export function ChatInput({ value, onChange, onSubmit, disabled, loading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = () => {
    if (value.trim() && !disabled && !loading) {
      onSubmit(value)
      onChange('')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  return (
    <GlassCard
      variant="card"
      className={cn(
        'transition-all duration-200',
        isFocused && 'ring-2 ring-[#E32D21]/50'
      )}
    >
      <div className="flex items-end gap-3 p-3">
        {/* Attachment button */}
        <GlassButton
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </GlassButton>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              handleInput()
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full bg-transparent text-white placeholder:text-white/40',
              'resize-none outline-none',
              'max-h-32 overflow-y-auto',
              'scrollbar-thin scrollbar-thumb-glass scrollbar-track-transparent'
            )}
          />
        </div>

        {/* Voice input button */}
        <GlassButton
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={disabled}
        >
          <Mic className="w-5 h-5" />
        </GlassButton>

        {/* Send button */}
        <GlassButton
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          loading={loading}
        >
          <Send className="w-5 h-5" />
        </GlassButton>
      </div>
    </GlassCard>
  )
}
