'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Loader2 } from 'lucide-react'

export function MessageSkeleton() {
  return (
    <GlassCard variant="card" className="p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-glass-white/10" />
        <div className="h-4 w-24 bg-glass-white/10 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-glass-white/10 rounded" />
        <div className="h-4 bg-glass-white/10 rounded w-5/6" />
      </div>
    </GlassCard>
  )
}

export function DocumentSkeleton() {
  return (
    <GlassCard variant="card" className="p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-glass-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-glass-white/10 rounded" />
          <div className="h-3 w-1/2 bg-glass-white/10 rounded" />
        </div>
      </div>
    </GlassCard>
  )
}

export function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-glass rounded-full animate-spin border-t-brand-red shadow-glass-red" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-red-light animate-spin" />
        </div>
      </div>
    </div>
  )
}

export function InlineLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <Loader2 className={`${sizeClasses[size]} text-white/50 animate-spin`} />
  )
}

export function ChatSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-glass-dark/30">
        <GlassCard variant="light" className="p-3 animate-pulse">
          <div className="h-8 bg-glass-white/10 rounded" />
        </GlassCard>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <MessageSkeleton />
        <MessageSkeleton />
        <MessageSkeleton />
      </div>

      <div className="p-4 border-t border-glass-dark/30">
        <GlassCard variant="card" className="p-3 animate-pulse">
          <div className="h-12 bg-glass-white/10 rounded" />
        </GlassCard>
      </div>
    </div>
  )
}

export function DocumentGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <DocumentSkeleton key={i} />
      ))}
    </div>
  )
}
