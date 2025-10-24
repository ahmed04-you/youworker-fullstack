"use client"

import {
  Wrench,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  Sparkles,
  FileText,
  Edit3,
  Search,
  FolderOpen,
  Terminal,
  Globe,
  Bot,
  Database,
  Code,
  GitBranch,
  TestTube,
  Hammer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { ToolRun } from "@/lib/contexts/chat-context"
import { useI18n } from "@/lib/i18n"

export function MobileToolSheet() {
  const { toolEvents, metadata } = useChatContext()
  const { t } = useI18n()

  const getToolIcon = (toolName: string) => {
    const name = toolName.toLowerCase()
    if (name.includes("read") || name.includes("file")) return FileText
    if (name.includes("write") || name.includes("edit")) return Edit3
    if (name.includes("search") || name.includes("grep")) return Search
    if (name.includes("glob") || name.includes("find")) return FolderOpen
    if (name.includes("bash") || name.includes("shell") || name.includes("command")) return Terminal
    if (name.includes("web") || name.includes("http") || name.includes("fetch")) return Globe
    if (name.includes("task") || name.includes("agent")) return Bot
    if (name.includes("database") || name.includes("db")) return Database
    if (name.includes("code") || name.includes("execute")) return Code
    if (name.includes("git")) return GitBranch
    if (name.includes("test")) return TestTube
    if (name.includes("build") || name.includes("compile")) return Hammer
    return Wrench
  }

  const runStatusStyles: Record<
    ToolRun["status"],
    { icon: JSX.Element; className: string; label: string }
  > = {
    running: {
      icon: <Clock className="h-4 w-4 text-sky-500 animate-pulse" />,
      className: "border-sky-500/40 text-sky-500 bg-sky-500/10",
      label: t("tool.status.running") || "In esecuzione",
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
      label: t("tool.status.success") || "Completato",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-rose-500" />,
      className: "border-rose-500/40 text-rose-500 bg-rose-500/10",
      label: t("tool.status.error") || "Errore",
    },
    cached: {
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      className: "border-purple-500/40 text-purple-500 bg-purple-500/10",
      label: t("tool.status.cached") || "Cache",
    },
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
        >
          <Wrench className="h-5 w-5" />
          {toolEvents.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {toolEvents.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            {t("tool.history.title") || "Eventi strumenti"}
            {toolEvents.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {toolEvents.length}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full mt-4">
          <div className="space-y-3 pb-8 flex flex-col">
            {toolEvents.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("tool.empty.events") || "Nessun evento strumento"}</p>
              </div>
            ) : (
              <>
                {toolEvents
                  .slice()
                  .reverse()
                  .map((run) => {
                    const ToolIcon = getToolIcon(run.tool)
                    const statusMeta = runStatusStyles[run.status]
                    const duration = run.latencyMs
                      ? formatDuration(run.latencyMs)
                      : run.startedAt && run.completedAt
                        ? formatDuration(
                            Math.max(
                              0,
                              new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime(),
                            ),
                          )
                        : null

                    return (
                      <div key={run.id} className="w-full max-w-full overflow-hidden rounded-lg border border-border/40 bg-background/50 p-2.5 shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ToolIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0 truncate">
                            <p className="text-xs font-medium truncate">{run.tool}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {duration && (
                              <span className="text-[0.65rem] text-muted-foreground font-mono">{duration}</span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn("h-5 px-1.5 text-[0.6rem] gap-1", statusMeta.className)}
                            >
                              {statusMeta.icon}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                {metadata && Object.keys(metadata).length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <Card className="p-4 rounded-xl border-primary/50 bg-primary/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">{t("tool.metadata.title") || "Metadati della risposta"}</span>
                      </div>
                      <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
                        {JSON.stringify(metadata, null, 2)}
                      </pre>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
