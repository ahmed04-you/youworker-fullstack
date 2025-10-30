'use client'

import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { Bot } from 'lucide-react'

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <GlassButton
      variant="secondary"
      size="sm"
      icon={<Bot className="w-4 h-4" />}
    >
      {value}
    </GlassButton>
  )
}
