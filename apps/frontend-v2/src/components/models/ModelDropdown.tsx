'use client'

import { useState, useRef, useEffect } from 'react'
import { Model } from '@/src/lib/types'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassInput } from '@/src/components/ui/glass/GlassInput'
import { ModelCard } from './ModelCard'
import { Search, X } from 'lucide-react'
import { cn } from '@/src/lib/utils'

interface ModelDropdownProps {
  models: Model[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  onClose: () => void
  isOpen: boolean
}

export function ModelDropdown({
  models,
  selectedModelId,
  onSelectModel,
  onClose,
  isOpen
}: ModelDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter models based on search query
  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.capabilities.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelectModel = (modelId: string) => {
    onSelectModel(modelId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dropdownRef}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
      >
        <GlassCard variant="heavy" className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-glass-dark)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Select Model</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-glass-white)]/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-[var(--color-glass-dark)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <GlassInput
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--color-glass-white)]/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredModels.length > 0 ? (
              filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={model.id === selectedModelId}
                  onClick={() => handleSelectModel(model.id)}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-white/50">No models found</p>
                <p className="text-sm text-white/30 mt-1">
                  Try adjusting your search query
                </p>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="p-4 border-t border-[var(--color-glass-dark)] bg-[#454055]/20">
            <p className="text-xs text-white/50 text-center">
              {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
