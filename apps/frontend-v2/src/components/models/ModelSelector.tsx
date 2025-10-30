'use client'

import { useState, useEffect } from 'react'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { ModelDropdown } from './ModelDropdown'
import { availableModels, getModelById } from '@/src/lib/data/models'
import { Bot, ChevronDown } from 'lucide-react'

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedModel = getModelById(value)

  // Load saved model preference on mount
  useEffect(() => {
    const savedModelId = localStorage.getItem('selectedModel')
    if (savedModelId && getModelById(savedModelId)) {
      onChange(savedModelId)
    }
  }, [])

  const handleSelectModel = (modelId: string) => {
    onChange(modelId)
    // Save to localStorage
    localStorage.setItem('selectedModel', modelId)
  }

  return (
    <>
      <GlassButton
        variant="secondary"
        size="sm"
        icon={<Bot className="w-4 h-4" />}
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <span>{selectedModel?.name || value}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </GlassButton>

      <ModelDropdown
        models={availableModels}
        selectedModelId={value}
        onSelectModel={handleSelectModel}
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}
      />
    </>
  )
}
