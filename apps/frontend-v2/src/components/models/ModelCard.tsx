'use client'

import { Model, ModelSpeed } from '@/src/lib/types'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Check, Zap, Clock, FileText } from 'lucide-react'
import { cn } from '@/src/lib/utils'

interface ModelCardProps {
  model: Model
  isSelected: boolean
  onClick: () => void
}

export function ModelCard({ model, isSelected, onClick }: ModelCardProps) {
  const speedIcon: Record<ModelSpeed, React.ReactElement> = {
    fast: <Zap className="w-3 h-3" />,
    medium: <Clock className="w-3 h-3" />,
    slow: <Clock className="w-3 h-3" />
  }

  const speedColor: Record<ModelSpeed, string> = {
    fast: 'text-green-400',
    medium: 'text-yellow-400',
    slow: 'text-orange-400'
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
    >
      <GlassCard
        variant="card"
        className={cn(
          'p-4 transition-all duration-200',
          isSelected && 'ring-2 ring-[#E32D21] bg-[#E32D21]/10'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Model name and selected indicator */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">{model.name}</h3>
              {isSelected && (
                <div className="shrink-0 w-5 h-5 rounded-full bg-[#E32D21] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-white/60 mb-3 line-clamp-2">{model.description}</p>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Speed indicator */}
              <div className={cn('flex items-center gap-1', speedColor[model.speed])}>
                {speedIcon[model.speed]}
                <span className="capitalize">{model.speed}</span>
              </div>

              {/* Context length */}
              <div className="flex items-center gap-1 text-white/50">
                <FileText className="w-3 h-3" />
                <span>{model.contextLength.toLocaleString()} tokens</span>
              </div>
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {model.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="px-2 py-0.5 rounded-full bg-[#454055]/50 text-[10px] text-white/70 border border-[var(--color-glass-dark)]"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </button>
  )
}
