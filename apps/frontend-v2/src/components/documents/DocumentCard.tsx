'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Document } from '@/src/lib/types'
import { FileText, Trash2 } from 'lucide-react'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { formatFileSize, formatTimestamp } from '@/src/lib/utils'

interface DocumentCardProps {
  document: Document
  onDelete: () => void
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  return (
    <GlassCard variant="card" interactive className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#E32D21]/20 to-[#454055]/40 flex items-center justify-center">
          <FileText className="w-5 h-5 text-[#F04438]" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">
            {document.title}
          </h3>
          <p className="text-xs text-white/50 mt-1">
            {formatFileSize(document.file_size)} • {formatTimestamp(document.created_at)}
          </p>
        </div>

        <div className="flex gap-1">
          <GlassButton variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
