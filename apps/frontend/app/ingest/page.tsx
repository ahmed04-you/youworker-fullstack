"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileText, FileAudio, FileImage, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface UploadedFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  documentId?: string
  error?: string
}

export default function IngestPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    }
  })

  const uploadFiles = async () => {
    setIsUploading(true)
    
    for (let i = 0; i < files.length; i++) {
      const fileData = files[i]
      if (fileData.status !== 'pending') continue

      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ))

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map((f, idx) => 
            idx === i && f.progress < 90 
              ? { ...f, progress: f.progress + 10 } 
              : f
          ))
        }, 200)

        const result = await apiClient.uploadDocument(fileData.file)
        
        clearInterval(progressInterval)
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i 
            ? { ...f, status: 'success' as const, progress: 100, documentId: result.document_id } 
            : f
        ))

        toast.success(`${fileData.file.name} uploaded successfully`)
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i 
            ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' } 
            : f
        ))
        toast.error(`Failed to upload ${fileData.file.name}`)
      }
    }

    setIsUploading(false)
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('audio/')) return <FileAudio className="h-8 w-8" />
    if (file.type.startsWith('image/')) return <FileImage className="h-8 w-8" />
    return <FileText className="h-8 w-8" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const successCount = files.filter(f => f.status === 'success').length

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 md:ml-72">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Document Ingestion</h1>
              <p className="text-muted-foreground mt-2">
                Upload documents to build your knowledge base. Supports PDF, text, audio, and image files.
              </p>
            </div>

            {/* Upload Stats */}
            {files.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{files.length}</div>
                      <div className="text-sm text-muted-foreground">Total Files</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{successCount}</div>
                      <div className="text-sm text-muted-foreground">Uploaded</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dropzone */}
            <Card>
              <CardContent className="pt-6">
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                    isDragActive 
                      ? "border-primary bg-primary/5" 
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p className="text-lg">Drop the files here...</p>
                  ) : (
                    <div>
                      <p className="text-lg font-medium mb-2">
                        Drag & drop files here, or click to select
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Supports PDF, TXT, MP3, WAV, PNG, JPG and more
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File List */}
            {files.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Files</CardTitle>
                    <CardDescription>
                      {pendingCount > 0 ? `${pendingCount} file(s) ready to upload` : 'All files processed'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {successCount > 0 && (
                      <Button variant="outline" size="sm" onClick={clearCompleted}>
                        Clear Completed
                      </Button>
                    )}
                    {pendingCount > 0 && (
                      <Button onClick={uploadFiles} disabled={isUploading}>
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>Upload {pendingCount} File(s)</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {files.map((fileData, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="text-muted-foreground">
                            {getFileIcon(fileData.file)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{fileData.file.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatFileSize(fileData.file.size)}
                            </div>
                            {fileData.status === 'uploading' && (
                              <Progress value={fileData.progress} className="mt-2" />
                            )}
                            {fileData.status === 'error' && (
                              <div className="text-sm text-destructive mt-1">{fileData.error}</div>
                            )}
                          </div>
                          <div>
                            {fileData.status === 'success' && (
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            )}
                            {fileData.status === 'error' && (
                              <XCircle className="h-6 w-6 text-destructive" />
                            )}
                            {fileData.status === 'uploading' && (
                              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}