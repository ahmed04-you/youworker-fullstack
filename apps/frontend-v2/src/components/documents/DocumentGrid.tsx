'use client'

import { useDocuments } from '@/src/lib/hooks/useDocuments'
import { DocumentCard } from './DocumentCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { GlassInput } from '@/src/components/ui/glass/GlassInput'
import { Upload, Search, FileText } from 'lucide-react'
import { useState } from 'react'

export function DocumentGrid() {
  const { documents, isLoading, deleteDocument } = useDocuments()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Documents</h1>
          <p className="text-white/50">
            Manage your knowledge base • {documents.length} documents
          </p>
        </div>

        <GlassButton
          variant="primary"
          icon={<Upload className="w-4 h-4" />}
        >
          Upload Document
        </GlassButton>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1">
          <GlassInput
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Document grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-[var(--color-glass-white)]/5 animate-pulse"
              />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#E32D21]/20 to-[#454055]/40 flex items-center justify-center backdrop-blur-[16px] border border-[var(--color-glass-red)] shadow-[var(--shadow-glass-red)]">
                <FileText className="w-8 h-8 text-[#F04438]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No documents found
                </h3>
                <p className="text-white/50 mb-4">
                  Upload documents to enhance your AI conversations
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={() => deleteDocument(document.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
