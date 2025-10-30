'use client'

import { useCallback, useState, DragEvent } from 'react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { Upload, X, File, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { uploadDocument } from '@/src/lib/api/documents'

interface UploadZoneProps {
  onClose: () => void
  onUploadComplete?: () => void
}

interface UploadFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export function UploadZone({ onClose, onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }, [])

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...uploadFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    setIsUploading(true)

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'success') continue

      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'uploading', progress: 0 } : f
      ))

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map((f, idx) =>
            idx === i && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
          ))
        }, 200)

        await uploadDocument(files[i].file, {
          title: files[i].file.name,
          size: files[i].file.size,
          type: files[i].file.type,
        })

        clearInterval(progressInterval)

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'success', progress: 100 } : f
        ))
      } catch (error) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ))
      }
    }

    setIsUploading(false)

    // If all files uploaded successfully, call the completion callback
    const allSuccess = files.every(f => f.status === 'success')
    if (allSuccess && onUploadComplete) {
      onUploadComplete()
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-brand-red-light" />
    }
    if (file.type.includes('pdf') || file.type.includes('text')) {
      return <FileText className="w-8 h-8 text-brand-red-light" />
    }
    return <File className="w-8 h-8 text-brand-red-light" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-deep-darker/80 backdrop-blur-glass-md">
      <GlassCard variant="heavy" className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-glass-dark">
          <div>
            <h2 className="text-2xl font-bold text-white">Upload Documents</h2>
            <p className="text-white/50 text-sm mt-1">
              Add documents to enhance your AI conversations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-glass-white/5 transition-colors"
          >
            <X className="w-6 h-6 text-white/70" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200',
              isDragging
                ? 'border-brand-red bg-glass-red/20'
                : 'border-glass hover:border-glass-red/50 hover:bg-glass-white/5'
            )}
          >
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />

            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-red/20 to-slate-deep/40 flex items-center justify-center backdrop-blur-glass-md border border-glass-red shadow-glass-red">
                <Upload className="w-8 h-8 text-brand-red-light" />
              </div>

              <div>
                <p className="text-lg font-semibold text-white mb-1">
                  {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                </p>
                <p className="text-white/50 text-sm">
                  or click to browse from your computer
                </p>
              </div>

              <div className="text-xs text-white/40">
                Supported: PDF, TXT, DOC, DOCX, MD (Max 10MB per file)
              </div>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/70">
                Files ({files.length})
              </h3>

              <div className="space-y-2">
                {files.map((uploadFile, index) => (
                  <GlassCard
                    key={index}
                    variant="card"
                    className="p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* File Icon */}
                      <div className="shrink-0">
                        {getFileIcon(uploadFile.file)}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-white/50">
                          {formatFileSize(uploadFile.file.size)}
                        </p>

                        {/* Progress Bar */}
                        {uploadFile.status === 'uploading' && (
                          <div className="mt-2 w-full h-1.5 bg-glass-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-brand transition-all duration-300"
                              style={{ width: `${uploadFile.progress}%` }}
                            />
                          </div>
                        )}

                        {/* Error Message */}
                        {uploadFile.status === 'error' && uploadFile.error && (
                          <p className="text-xs text-brand-red mt-1">
                            {uploadFile.error}
                          </p>
                        )}
                      </div>

                      {/* Status Icon */}
                      <div className="shrink-0">
                        {uploadFile.status === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                        {uploadFile.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-brand-red" />
                        )}
                        {uploadFile.status === 'pending' && !isUploading && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 rounded hover:bg-glass-white/10 transition-colors"
                          >
                            <X className="w-4 h-4 text-white/50" />
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-glass-dark">
          <GlassButton
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </GlassButton>

          <GlassButton
            variant="primary"
            onClick={uploadFiles}
            disabled={files.length === 0 || isUploading || files.every(f => f.status === 'success')}
            loading={isUploading}
          >
            Upload {files.length > 0 && `(${files.length})`}
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  )
}
