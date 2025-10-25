"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, AlertCircle, MessageSquare, CheckCircle2, X, Loader2, Link as LinkIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { postIngest, postIngestUpload } from "@/lib/api"
import type { IngestResponse } from "@/lib/types"
import { toast } from "sonner"
import { useChatContext } from "@/lib/contexts/chat-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export default function IngestPage() {
  const router = useRouter()
  const { setSuggestedPrompt } = useChatContext()
  const { t } = useI18n()
  const [source, setSource] = useState<"upload" | "web">("upload")
  const [files, setFiles] = useState<File[]>([])
  const [webUrl, setWebUrl] = useState("")
  const [tags, setTags] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<IngestResponse | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const canSubmit = source === "upload" ? files.length > 0 : webUrl.trim().length > 0

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles])
      toast.success(`${droppedFiles.length} ${t("ingest.files_added") || "file aggiunti"}`)
    }
  }, [t])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...selectedFiles])
      toast.success(`${selectedFiles.length} ${t("ingest.files_selected") || "file selezionati"}`)
    }
  }, [t])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (source === "upload" && files.length === 0) {
      toast.error(t("ingest.error.select_file") || "Seleziona almeno un file")
      return
    }
    if (source === "web" && !webUrl.trim()) {
      toast.error(t("ingest.error.url_required") || "URL obbligatorio")
      return
    }

    setIsLoading(true)
    setUploadProgress(0)
    setResult(null)

    try {
      let response: IngestResponse
      const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined

      if (source === "upload") {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90))
        }, 200)

        try {
          response = await postIngestUpload(files, tagList)
          clearInterval(progressInterval)
          setUploadProgress(100)
        } catch (error) {
          clearInterval(progressInterval)
          throw error
        }
      } else {
        response = await postIngest({
          path_or_url: webUrl,
          from_web: true,
          tags: tagList,
        })
      }

      setResult(response)
      if (response.success) {
        toast.success(`${t("ingest.success.completed") || "Ingestione completata"}: ${response.totals.files} ${t("ingest.files") || "file"}, ${response.totals.chunks} ${t("ingest.chunks") || "chunk"}`)
      } else if (response.errors.length > 0) {
        toast.warning(`${t("ingest.warning.completed_with_errors") || "Completata con"} ${response.errors.length} ${response.errors.length === 1 ? (t("ingest.error") || "errore") : (t("ingest.errors") || "errori")}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (t("ingest.error.failed") || "Ingestione non riuscita")
      toast.error(errorMessage)
      setResult({
        success: false,
        totals: { files: 0, chunks: 0, total_bytes: 0 },
        files: [],
        errors: [errorMessage],
      })
    } finally {
      setIsLoading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  const handleStartChat = () => {
    if (!result) return
    setSuggestedPrompt(
      `Ho appena ingerito ${result.totals.files} file (${result.totals.chunks} chunk). Puoi aiutarmi a capire cosa contengono questi documenti?`,
    )
    router.push("/")
  }

  return (
    <div className="container mx-auto flex min-h-full flex-col p-4 sm:p-6 lg:p-8">
      <Card className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border-border/50 bg-card/60 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-start gap-3 border-b border-border/50 px-4 py-6 sm:px-6 lg:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">{t("ingest.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("ingest.description")}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs value={source} onValueChange={(value) => setSource(value as "upload" | "web")} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1">
                  <TabsTrigger value="upload" className="rounded-xl data-[state=active]:bg-background/90">
                    {t("ingest.upload_files") || "Carica file"}
                  </TabsTrigger>
                  <TabsTrigger value="web" className="rounded-xl data-[state=active]:bg-background/90">
                    {t("ingest.web_url") || "URL web"}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                  <div className="space-y-2">
                    <Label>{t("ingest.upload_files") || "Carica file"} *</Label>
                    {/* Drag & Drop Area */}
                    <div
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
                        isDragging
                          ? "border-primary bg-primary/10 scale-[1.02]"
                          : "border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
                        isLoading && "pointer-events-none opacity-50",
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isLoading}
                      />
                      <Upload className={cn("mb-3 h-10 w-10 transition-all", isDragging ? "scale-110 text-primary" : "text-muted-foreground")} />
                      <p className="text-center text-sm font-medium">
                        {isDragging ? (t("ingest.drop_files_here") || "Rilascia i file qui") : (t("ingest.drag_or_click") || "Trascina i file qui o clicca per selezionare")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("ingest.supported_formats") || "Supporta tutti i formati comuni (PDF, DOC, immagini, audio, video)"}
                      </p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            {files.length} {t("ingest.files_selected") || "file selezionati"}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFiles([])}
                            className="h-7 text-xs"
                            disabled={isLoading}
                          >
                            {t("ingest.remove_all") || "Rimuovi tutti"}
                          </Button>
                        </div>
                        <ScrollArea className="h-[140px] rounded-2xl border border-border/40 bg-background/60 p-3">
                          <AnimatePresence>
                            {files.map((file, index) => (
                              <motion.div
                                key={`${file.name}-${index}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-2 transition-colors last:mb-0 hover:bg-muted/60"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                    <FileText className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatBytes(file.size)}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                                  onClick={() => removeFile(index)}
                                  disabled={isLoading}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span className="sr-only">{t("ingest.remove_file") || "Rimuovi file"}</span>
                                </Button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="web" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                  <div className="space-y-2">
                    <Label htmlFor="web-url">{t("ingest.web_url") || "URL web"} *</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="web-url"
                        value={webUrl}
                        onChange={(e) => setWebUrl(e.target.value)}
                        placeholder={t("ingest.url_placeholder") || "https://example.com/documento"}
                        className="rounded-2xl pl-9"
                        disabled={isLoading}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("ingest.url_description") || "Scarica e analizza la pagina web indicata, estraendo testo, immagini e tabelle."}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="tags">{t("ingest.tags_label") || "Tag"} ({t("ingest.tags_separator") || "separati da virgola"})</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t("ingest.tags_placeholder") || "documentazione, api, riferimento"}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  disabled={isLoading || !canSubmit}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {source === "upload" ? (t("ingest.uploading") || "Caricamento in corso…") : (t("ingest.analyzing") || "Analisi URL in corso…")}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {source === "upload" ? (t("ingest.upload_and_index") || "Carica e indicizza") : (t("ingest.analyze_url") || "Analizza URL")}
                    </>
                  )}
                </Button>

                {/* Progress Bar */}
                {isLoading && source === "upload" && uploadProgress > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("ingest.upload_and_process") || "Caricamento ed elaborazione"}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </form>

            {isLoading && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40 rounded-xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              </>
            )}

            {!isLoading && result && (
              <>
                <Separator />
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Success Banner */}
                  {result.success && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border-2 border-green-500/30 bg-green-500/10 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-green-500/20 p-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-300">
                            {t("ingest.success.title") || "Ingestione completata con successo!"}
                          </p>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80">
                            {t("ingest.success.description") || "I documenti sono ora disponibili per la ricerca e l'analisi"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-2xl border border-border/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-4 w-4 text-blue-500" />
                        {t("ingest.files_processed") || "File processati"}
                      </div>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {result.totals.files}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-2xl border border-border/50 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-purple-500" />
                        {t("ingest.chunks_created") || "Chunk creati"}
                      </div>
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {result.totals.chunks}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl border border-border/50 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Upload className="h-4 w-4 text-emerald-500" />
                        {t("ingest.total_size") || "Dimensione totale"}
                      </div>
                      <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBytes(result.totals.total_bytes)}
                      </div>
                    </motion.div>
                  </div>

                  {result.files.length > 0 && (
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-muted-foreground">{t("ingest.files") || "File"}</h2>
                      <Card className="overflow-hidden rounded-2xl border border-border/40 bg-background/60">
                        <ScrollArea className="h-[260px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("ingest.table.path") || "Percorso"}</TableHead>
                                <TableHead>{t("ingest.table.type") || "Tipo"}</TableHead>
                                <TableHead className="text-right">{t("ingest.table.chunks") || "Chunk"}</TableHead>
                                <TableHead className="text-right">{t("ingest.table.size") || "Dimensione"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.files.map((file, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-xs">{file.path}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="rounded-full">
                                      {file.mime_type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{file.chunks}</TableCell>
                                  <TableCell className="text-right text-sm">{formatBytes(file.size_bytes)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                    </div>
                  )}

                  {result.errors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Accordion type="single" collapsible className="rounded-2xl border-2 border-destructive/30 bg-destructive/5">
                        <AccordionItem value="errors" className="border-none">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="h-5 w-5" />
                              <span className="font-semibold">
                                {result.errors.length} {result.errors.length === 1 ? (t("ingest.error") || "errore") : (t("ingest.errors") || "errori")}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {result.errors.map((error, idx) => (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs"
                                  >
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                                      <p className="break-all font-mono text-destructive">{error}</p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </ScrollArea>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </motion.div>
                  )}

                  {result.success && (
                    <Button
                      onClick={handleStartChat}
                      className="h-11 w-full rounded-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {t("ingest.start_chat") || "Avvia una chat su questi documenti"}
                    </Button>
                  )}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
