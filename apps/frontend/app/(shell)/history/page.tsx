"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { History, MessageSquare, FileText, Upload, Trash2, RefreshCw, Calendar } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { useI18n } from "@/lib/i18n"
import { useChatSettings } from "@/lib/mode"

export default function HistoryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("sessions")
  const [sessions, setSessions] = useState<Session[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; name: string } | null>(null)
  const { t } = useI18n()
  const { uiLanguage } = useChatSettings()

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getSessions(100)
      setSessions(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("history.error.load_sessions"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const { documents: docs } = await getDocuments(undefined, 100)
      setDocuments(docs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("history.error.load_documents"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const loadIngestionRuns = useCallback(async () => {
    try {
      setIsLoading(true)
      const { runs } = await getIngestionRuns(100)
      setIngestionRuns(runs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("history.error.load_ingestion"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (activeTab === "sessions") {
      loadSessions()
    } else if (activeTab === "documents") {
      loadDocuments()
    } else if (activeTab === "ingestion") {
      loadIngestionRuns()
    }
  }, [activeTab, loadSessions, loadDocuments, loadIngestionRuns])

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === "session") {
        await deleteSession(deleteTarget.id)
        setSessions(sessions.filter((s) => s.id !== deleteTarget.id))
        toast.success(t("history.toast.session_deleted"))
      } else if (deleteTarget.type === "document") {
        await deleteDocument(deleteTarget.id)
        setDocuments(documents.filter((d) => d.id !== deleteTarget.id))
        toast.success(t("history.toast.document_deleted"))
      } else if (deleteTarget.type === "ingestion") {
        await deleteIngestionRun(deleteTarget.id)
        setIngestionRuns(ingestionRuns.filter((r) => r.id !== deleteTarget.id))
        toast.success(t("history.toast.ingestion_deleted"))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("history.toast.delete_failed"))
    } finally {
      setDeleteTarget(null)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const locale = uiLanguage === "en" ? "en-US" : "it-IT"
    return new Intl.DateTimeFormat(locale, {
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
        return t("history.status.success")
      case "partial":
        return t("history.status.partial")
      case "error":
        return t("history.status.error")
      default:
        return status
    }
  }

  return (
    <div className="container mx-auto flex min-h-full flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex-1 rounded-2xl border-border/50 bg-card/50 p-4 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">{t("history.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => router.push("/")}>
            {t("history.button.back")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-1">
            <TabsTrigger value="sessions" className="rounded-xl data-[state=active]:bg-background/90">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t("history.tabs.sessions")}
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-xl data-[state=active]:bg-background/90">
              <FileText className="mr-2 h-4 w-4" />
              {t("history.tabs.documents")}
            </TabsTrigger>
            <TabsTrigger value="ingestion" className="rounded-xl data-[state=active]:bg-background/90">
              <Upload className="mr-2 h-4 w-4" />
              {t("history.tabs.ingestion")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t("history.sessions.count", { count: sessions.length })}
                </p>
                <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {t("history.button.refresh")}
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <Empty className="h-64 border border-border/40 bg-background/60">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>{t("history.empty.sessions.title")}</EmptyTitle>
                    <EmptyDescription>{t("history.empty.sessions.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>{t("history.table.title")}</TableHead>
                        <TableHead>{t("history.table.model")}</TableHead>
                        <TableHead>{t("history.table.created")}</TableHead>
                        <TableHead>{t("history.table.updated")}</TableHead>
                        <TableHead className="text-right">{t("history.table.actions")}</TableHead>
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
                              {session.title || <span className="italic text-muted-foreground">{t("history.table.untitled")}</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{session.model || t("history.table.not_available")}</Badge>
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
                                  {t("history.action.open")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "session",
                                      id: session.id,
                                      name: session.title || t("history.table.untitled"),
                                    })
                                  }
                                  className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                                  aria-label={t("history.action.delete")}
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
                <p className="text-sm text-muted-foreground">
                  {t("history.documents.count", { count: documents.length })}
                </p>
                <Button variant="outline" size="sm" onClick={loadDocuments} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {t("history.button.refresh")}
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <Empty className="h-64 border border-border/40 bg-background/60">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText className="h-6 w-6 text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>{t("history.empty.documents.title")}</EmptyTitle>
                    <EmptyDescription>{t("history.empty.documents.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>{t("history.table.title")}</TableHead>
                        <TableHead>{t("history.table.type")}</TableHead>
                        <TableHead>{t("history.table.size")}</TableHead>
                        <TableHead>{t("history.table.source")}</TableHead>
                        <TableHead>{t("history.table.ingested")}</TableHead>
                        <TableHead className="text-right">{t("history.table.actions")}</TableHead>
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
                              {doc.path || doc.uri || t("history.table.not_available")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{doc.mime || t("history.table.unknown")}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatBytes(doc.bytes_size)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{doc.source || t("history.table.not_available")}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.last_ingested_at ? formatDate(doc.last_ingested_at) : t("history.table.not_available")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "document",
                                    id: doc.id,
                                    name: doc.path || doc.uri || t("history.table.unknown"),
                                  })
                                }
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                                aria-label={t("history.action.delete")}
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
                <p className="text-sm text-muted-foreground">
                  {t("history.ingestion.count", { count: ingestionRuns.length })}
                </p>
                <Button variant="outline" size="sm" onClick={loadIngestionRuns} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {t("history.button.refresh")}
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : ingestionRuns.length === 0 ? (
                <Empty className="h-64 border border-border/40 bg-background/60">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Upload className="h-6 w-6 text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>{t("history.empty.ingestion.title")}</EmptyTitle>
                    <EmptyDescription>{t("history.empty.ingestion.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-[600px] rounded-2xl border border-border/40">
                  <Table>
                    <TableHeader className={stickyHeaderClass}>
                      <TableRow>
                        <TableHead>{t("history.table.title")}</TableHead>
                        <TableHead>{t("history.table.type")}</TableHead>
                        <TableHead>{t("history.table.files")}</TableHead>
                        <TableHead>{t("history.table.chunks")}</TableHead>
                        <TableHead>{t("history.table.status")}</TableHead>
                        <TableHead>{t("history.table.created")}</TableHead>
                        <TableHead className="text-right">{t("history.table.actions")}</TableHead>
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
                              <Badge variant="outline">
                                {run.from_web ? t("history.table.type_web") : t("history.table.type_file")}
                              </Badge>
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
                                    name: run.target || t("history.table.unknown"),
                                  })
                                }
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                                aria-label={t("history.action.delete")}
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
            <AlertDialogTitle>{t("history.dialog.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("history.dialog.delete_body", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("history.dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t("history.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
