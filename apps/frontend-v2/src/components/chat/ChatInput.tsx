'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { Send, Paperclip, Mic, MicOff, X } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { useVoiceRecording } from '@/src/lib/hooks/useVoiceRecording'

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
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  const {
    recordingState,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording
  } = useVoiceRecording({
    onRecordingComplete: (audioBlob) => {
      // In a real app, you would send this to a speech-to-text API
      console.log('Recording complete:', audioBlob)
      setShowVoiceModal(false)
      // For now, just show a placeholder message
      onChange('[Voice message recorded - Speech-to-text API not connected]')
    },
    onError: (error) => {
      console.error('Recording error:', error)
      alert(error.message)
      setShowVoiceModal(false)
    },
    maxDuration: 120000 // 2 minutes
  })

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

  const handleVoiceClick = () => {
    setShowVoiceModal(true)
    startRecording()
  }

  const handleStopRecording = () => {
    stopRecording()
  }

  const handleCancelRecording = () => {
    cancelRecording()
    setShowVoiceModal(false)
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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
          onClick={handleVoiceClick}
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

      {/* Voice Recording Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <GlassCard variant="heavy" className="w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center gap-6">
              {/* Header */}
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg font-semibold text-white">
                  {recordingState === 'processing' ? 'Processing...' : 'Recording'}
                </h3>
                <button
                  onClick={handleCancelRecording}
                  className="p-2 rounded-lg hover:bg-[var(--color-glass-white)]/10 transition-colors"
                  disabled={recordingState === 'processing'}
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* Waveform visualization */}
              <div className="relative w-full h-32 flex items-center justify-center">
                {/* Pulsing circle */}
                <div
                  className={cn(
                    'absolute w-24 h-24 rounded-full transition-all duration-300',
                    isRecording
                      ? 'bg-[#E32D21] animate-pulse'
                      : 'bg-[#454055]/50'
                  )}
                  style={{
                    transform: `scale(${1 + audioLevel / 200})`
                  }}
                />

                {/* Mic icon */}
                <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-brand flex items-center justify-center">
                  {isRecording ? (
                    <Mic className="w-8 h-8 text-white" />
                  ) : (
                    <MicOff className="w-8 h-8 text-white" />
                  )}
                </div>

                {/* Audio level bars */}
                {isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-[#E32D21] rounded-full transition-all duration-100"
                        style={{
                          height: `${20 + (audioLevel / 2) * Math.sin(Date.now() / 200 + i)}%`,
                          opacity: 0.6
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-white mb-1">
                  {formatDuration(duration)}
                </div>
                <p className="text-sm text-white/60">
                  {recordingState === 'processing'
                    ? 'Processing your recording...'
                    : 'Maximum 2 minutes'}
                </p>
              </div>

              {/* Controls */}
              <div className="flex gap-3 w-full">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={handleCancelRecording}
                  disabled={recordingState === 'processing'}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  className="flex-1"
                  onClick={handleStopRecording}
                  disabled={recordingState === 'processing' || !isRecording}
                >
                  {recordingState === 'processing' ? 'Processing...' : 'Stop & Send'}
                </GlassButton>
              </div>

              {/* Tips */}
              <div className="w-full p-3 rounded-lg bg-[#454055]/30 border border-[var(--color-glass-dark)]">
                <p className="text-xs text-white/50 text-center">
                  Speak clearly into your microphone. Your recording will be converted to text automatically.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </GlassCard>
  )
}
