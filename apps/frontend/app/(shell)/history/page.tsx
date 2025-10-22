"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { History, MessageSquare, FileText, Upload, Trash2, Loader2, RefreshCw, Calendar } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  getSessions,
  deleteSession,
  getDocuments,
  deleteDocument,
  getIngestionRuns,
  deleteIngestionRun,
} from "@/lib/api"
import type { Session, Document, IngestionRun } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"

export default function HistoryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("sessions")
  const [sessions, setSessions] = useState<Session[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null)

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const data = await getSessions(100)
      setSessions(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare le sessioni")
    } finally {
      setIsLoading(false)
    }
  }

  const loadDocuments = async () => {
    try {
      setIsLoading(true)
      const { documents: docs } = await getDocuments(undefined, 100)
      setDocuments(docs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare i documenti")
    } finally {
      setIsLoading(false)
    }
  }

  const loadIngestionRuns = async () => {
    try {
      setIsLoading(true)
      const { runs } = await getIngestionRuns(100)
      setIngestionRuns(runs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare le operazioni di ingestione")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "sessions") {
      loadSessions()
    } else if (activeTab === "documents") {
      loadDocuments()
    } else if (activeTab === "ingestion") {
      loadIngestionRuns()
    }
  }, [activeTab])

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === "session") {
        await deleteSession(deleteTarget.id)
        setSessions(sessions.filter((s) => s.id !== deleteTarget.id))
        toast.success("Sessione eliminata")
      } else if (deleteTarget.type === "document") {
        await deleteDocument(deleteTarget.id)
        setDocuments(documents.filter((d) => d.id !== deleteTarget.id))
        toast.success("Documento eliminato")
      } else if (deleteTarget.type === "ingestion") {
        await deleteIngestionRun(deleteTarget.id)
        setIngestionRuns(ingestionRuns.filter((r) => r.id !== deleteTarget.id))
        toast.success("Ingestione eliminata")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eliminazione non riuscita")
    } finally {
      setDeleteTarget(null)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date)
  }

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const stickyHeaderClass =
    "sticky top-0 z-10 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 shadow-sm"

  const formatIngestionStatus = (status: string) => {
    switch (status) {
      case "success":
        return "Successo"
      case "partial":
        return "Parziale"
      case "error":
        return "Errore"
      default:
        return status
    }
  }

  return (
    <div className="container mx-auto flex min-h-full flex-col p-6 py-8">
      <div className="flex-1 rounded-2xl border-border/50 bg-card/50 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Cronologia</h1>
              <p className="text-sm text-muted-foreground">Gestisci sessioni, documenti e cronologia ingestione</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => router.push("/")}>
            Torna alla chat
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-1">
            <TabsTrigger value="sessions" className="rounded-xl data-[state=active]:bg-background/90">
              <MessageSquare className="mr-2 h-4 w-4" />
              Sessioni
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl data-[state=active]:bg-background/90">
              <FileText className="mr-2 h-4 w-4" />
              Documenti
            </TabsTrigger>
            <TabsTrigger value="ingestion" className="rounded-xl data-[state=active]:bg-background/90">
              <Upload className="mr-2 h-4 w-4" />
              Ingestioni
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{sessions.length} sessioni trovate</p>
                <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Aggiorna
                </Button>
              </div>

              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nessuna sessione trovata</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Modello</TableHead>
                        <TableHead>Creata</TableHead>
                        <TableHead>Aggiornata</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {sessions.map((session) => (
                          <motion.tr
                            key={session.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            <TableCell className="font-medium">
                              {session.title || <span className="italic text-muted-foreground">Senza titolo</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{session.model || "N/D"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(session.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(session.updated_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/?session=${session.id}`)}
                                  className="opacity-0 group-hover:opacity-100"
                                >
                                  Apri
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "session",
                                      id: session.id,
                                      name: session.title || "Sessione senza titolo",
                                    })
                                  }
                                  className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{documents.length} documenti trovati</p>
                <Button variant="outline" size="sm" onClick={loadDocuments} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Aggiorna
                </Button>
              </div>

              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nessun documento trovato</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>Percorso</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Dimensione</TableHead>
                        <TableHead>Sorgente</TableHead>
                        <TableHead>Ingerito</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {documents.map((doc) => (
                          <motion.tr
                            key={doc.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            <TableCell className="max-w-md truncate font-mono text-xs">
                              {doc.path || doc.uri || "N/D"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{doc.mime || "unknown"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatBytes(doc.bytes_size)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{doc.source || "N/D"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.last_ingested_at ? formatDate(doc.last_ingested_at) : "N/D"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "document",
                                    id: doc.id,
                                    name: doc.path || doc.uri || "Documento",
                                  })
                                }
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ingestion" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{ingestionRuns.length} ingestioni trovate</p>
                <Button variant="outline" size="sm" onClick={loadIngestionRuns} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Aggiorna
                </Button>
              </div>

              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ingestionRuns.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                  <Upload className="h-12 w-12 mb-3 opacity-50" />
                  <p>Nessuna ingestione trovata</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>Target</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Chunk</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {ingestionRuns.map((run) => (
                          <motion.tr
                            key={run.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            <TableCell className="max-w-md truncate font-mono text-xs">{run.target}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{run.from_web ? "Web" : "File"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{run.totals_files}</TableCell>
                            <TableCell className="text-sm">{run.totals_chunks}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  run.status === "success"
                                    ? "default"
                                    : run.status === "partial"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {formatIngestionStatus(run.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(run.started_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "ingestion",
                                    id: run.id,
                                    name: `Ingestione ${run.target}`,
                                  })
                                }
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deleteTarget?.name}"? Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
