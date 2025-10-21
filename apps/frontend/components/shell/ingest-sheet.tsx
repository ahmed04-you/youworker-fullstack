"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Upload, FileText, AlertCircle, MessageSquare, CheckCircle2, RefreshCcw } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
import { SpinLoader } from "@/components/aceternity/loaders"
import { postIngest } from "@/lib/api"
import type { IngestResponse } from "@/lib/types"
import { toast } from "sonner"
import { useChatContext } from "@/lib/contexts/chat-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"

interface IngestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IngestSheet({ open, onOpenChange }: IngestSheetProps) {
  const router = useRouter()
  const { setSuggestedPrompt } = useChatContext()
  const [source, setSource] = useState<"file" | "web">("file")
  const [filePath, setFilePath] = useState("")
  const [webUrl, setWebUrl] = useState("")
  const [recursive, setRecursive] = useState(true)
  const [tags, setTags] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<IngestResponse | null>(null)
  const selectedInput = source === "file" ? filePath : webUrl
  const canSubmit = selectedInput.trim().length > 0

  useEffect(() => {
    if (!open) {
      setSource("file")
      setFilePath("")
      setWebUrl("")
      setTags("")
      setIsLoading(false)
      setResult(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInput.trim()) {
      toast.error(source === "file" ? "Percorso file obbligatorio" : "URL obbligatorio")
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const response = await postIngest({
        path_or_url: selectedInput,
        recursive: source === "file" ? recursive : undefined,
        from_web: source === "web",
        tags: tags ? tags.split(",").map((t) => t.trim()) : undefined,
      })

      setResult(response)
      if (response.success) {
        toast.success(`Ingestione completata: ${response.totals.files} file`)
      } else {
        toast.error("Ingestione completata con errori")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ingestione non riuscita")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartChat = () => {
    if (!result) return
    setSuggestedPrompt(
      `Ho appena ingerito ${result.totals.files} file (${result.totals.chunks} chunk). Puoi aiutarmi a capire cosa contengono questi documenti?`,
    )
    onOpenChange(false)
    router.push("/")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[720px] border-none bg-transparent p-0 shadow-none"
        showCloseButton
      >
        <Card className="flex h-[75vh] max-h-[80vh] flex-col overflow-hidden rounded-2xl border-border/50 bg-card/60 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-3 border-b border-border/50 px-8 py-6">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-2xl font-semibold">Caricamento ed elaborazione file</DialogTitle>
              <DialogDescription className="mt-1">
                Aggiungi percorsi locali o URL per arricchire il workspace prima di parlarne con l&apos;assistente.
              </DialogDescription>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={source} onValueChange={(value) => setSource(value as "file" | "web")} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1">
                    <TabsTrigger value="file" className="rounded-xl data-[state=active]:bg-background/90">
                      Percorso file
                    </TabsTrigger>
                    <TabsTrigger value="web" className="rounded-xl data-[state=active]:bg-background/90">
                      URL web
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" className="space-y-2 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="file-path">Percorso file *</Label>
                        <Input
                          id="file-path"
                          value={filePath}
                          onChange={(e) => setFilePath(e.target.value)}
                          placeholder="/percorso/ai/documenti"
                          className="rounded-2xl"
                        />
                      </div>
                      <Toggle
                        aria-label="Includi le directory annidate"
                        pressed={recursive}
                        onPressedChange={setRecursive}
                        variant="outline"
                        className="h-11 rounded-2xl px-4 text-sm font-medium"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Ricorsivo
                      </Toggle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Includi automaticamente le directory annidate del percorso indicato.
                    </p>
                  </TabsContent>
                  <TabsContent value="web" className="space-y-2 focus-visible:outline-none focus-visible:ring-0">
                    <Label htmlFor="web-url">URL *</Label>
                    <Input
                      id="web-url"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      placeholder="https://esempio.com/docs"
                      className="rounded-2xl"
                    />
                    <p className="text-xs text-muted-foreground">Il caricamento da URL analizza solo la risorsa specificata.</p>
                  </TabsContent>
                </Tabs>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tag (separati da virgola)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="documentazione, api, riferimento"
                    className="rounded-2xl"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  disabled={isLoading || !canSubmit}
                >
                  {isLoading ? (
                    <>
                      <SpinLoader className="mr-2" />
                      Caricamento in corso…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Carica file
                    </>
                  )}
                </Button>
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
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          File
                        </div>
                        <div className="mt-1 text-2xl font-semibold">{result.totals.files}</div>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4" />
                          Chunk
                        </div>
                        <div className="mt-1 text-2xl font-semibold">{result.totals.chunks}</div>
                      </div>
                      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Upload className="h-4 w-4" />
                          Dimensione
                        </div>
                        <div className="mt-1 text-2xl font-semibold">{formatBytes(result.totals.total_bytes)}</div>
                      </div>
                    </div>

                    {result.files.length > 0 && (
                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-muted-foreground">File</h2>
                        <Card className="overflow-hidden rounded-2xl border border-border/40 bg-background/60">
                          <ScrollArea className="h-[260px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Percorso</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead className="text-right">Chunk</TableHead>
                                  <TableHead className="text-right">Dimensione</TableHead>
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
                      <Accordion type="single" collapsible className="rounded-2xl border border-border/50">
                        <AccordionItem value="errors" className="border-none">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <span>{result.errors.length} errore/i</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {result.errors.map((error, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-xl bg-destructive/10 p-3 text-xs font-mono text-destructive"
                                  >
                                    {error}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}

                    {result.success && (
                      <Button
                        onClick={handleStartChat}
                        className="h-11 w-full rounded-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Avvia una chat su questi documenti
                      </Button>
                    )}
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
