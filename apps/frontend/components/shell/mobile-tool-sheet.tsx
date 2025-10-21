"use client"

import { useState } from "react"
import {
  Wrench,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Database,
  Code,
  Globe,
  Terminal,
  Sparkles,
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

export function MobileToolSheet() {
  const { toolEvents, metadata } = useChatContext()
  const [expandedArgs, setExpandedArgs] = useState<Set<string>>(new Set())

  const getToolIcon = (toolName: string) => {
    const name = toolName.toLowerCase()
    if (name.includes("search") || name.includes("query")) return Search
    if (name.includes("file") || name.includes("read")) return FileText
    if (name.includes("database") || name.includes("db")) return Database
    if (name.includes("code") || name.includes("execute")) return Code
    if (name.includes("web") || name.includes("http")) return Globe
    if (name.includes("shell") || name.includes("command")) return Terminal
    return Wrench
  }

  const runStatusStyles: Record<
    ToolRun["status"],
    { icon: JSX.Element; className: string; label: string }
  > = {
    running: {
      icon: <Clock className="h-4 w-4 text-sky-500 animate-pulse" />,
      className: "border-sky-500/40 text-sky-500 bg-sky-500/10",
      label: "In esecuzione",
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
      label: "Completato",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-rose-500" />,
      className: "border-rose-500/40 text-rose-500 bg-rose-500/10",
      label: "Errore",
    },
    cached: {
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      className: "border-purple-500/40 text-purple-500 bg-purple-500/10",
      label: "Cache",
    },
  }

  const getUpdateIcon = (status: ToolRun["updates"][number]["status"]) => {
    switch (status) {
      case "start":
        return <Clock className="h-3.5 w-3.5 text-sky-500" />
      case "end":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-rose-500" />
      case "cached":
        return <Sparkles className="h-3.5 w-3.5 text-purple-500" />
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  const getUpdateLabel = (status: ToolRun["updates"][number]["status"]) => {
    switch (status) {
      case "start":
        return "Avviato"
      case "end":
        return "Completato"
      case "ok":
        return "Completato"
      case "error":
        return "Errore"
      case "cached":
        return "Cache"
      default:
        return status
    }
  }

  const toggleArgExpansion = (eventId: string) => {
    setExpandedArgs((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
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
            Eventi strumenti
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
                <p>Nessun evento strumento</p>
              </div>
            ) : (
              <>
                {toolEvents
                  .slice()
                  .reverse()
                  .map((run) => {
                    const ToolIcon = getToolIcon(run.tool)
                    const isExpanded = expandedArgs.has(run.id)
                    const hasArgs = run.args && Object.keys(run.args).length > 0
                    const argsString = hasArgs ? JSON.stringify(run.args) : ""
                    const truncatedArgs = argsString.length > 60 ? `${argsString.slice(0, 60)}…` : argsString
                    const statusMeta = runStatusStyles[run.status]

                    return (
                      <Card key={run.id} className="w-full rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 place-items-center rounded-xl border border-border/40 bg-muted/40">
                              <ToolIcon className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{run.tool}</p>
                              {run.server && (
                                <p className="text-xs text-muted-foreground leading-tight truncate">Server · {run.server}</p>
                              )}
                            </div>
                          </div>
                          <Badge className={cn("flex items-center gap-1 text-[0.65rem]", statusMeta.className)}>
                            {statusMeta.icon}
                            {statusMeta.label}
                          </Badge>
                        </div>

                        {hasArgs && (
                          <div className="mt-3 rounded-xl border border-border/40 bg-muted/40 p-2 text-xs font-mono text-muted-foreground">
                            {isExpanded ? (
                              <pre className="max-h-48 whitespace-pre-wrap break-all text-muted-foreground">
                                {JSON.stringify(run.args, null, 2)}
                              </pre>
                            ) : (
                              <div className="truncate">{truncatedArgs}</div>
                            )}
                            {argsString.length > 60 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleArgExpansion(run.id)}
                                className="mt-1 h-6 px-2 text-[0.65rem]"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="mr-1 h-3 w-3" />
                                    Comprimi
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="mr-1 h-3 w-3" />
                                    Espandi
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                        <div className="mt-3 space-y-1.5">
                          {run.updates.map((update) => (
                            <div
                              key={update.id}
                              className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground"
                            >
                              <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted/60">
                                {getUpdateIcon(update.status)}
                              </span>
                              <span className="min-w-0 truncate font-medium">{getUpdateLabel(update.status)}</span>
                              <span className="ml-auto text-[0.65rem] text-muted-foreground/80">
                                {update.ts ? new Date(update.ts).toLocaleTimeString() : "—"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {(run.latencyMs || (run.startedAt && run.completedAt)) && (
                          <div className="mt-3 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                            <span>Durata</span>
                            <span className="font-medium text-foreground">
                              {run.latencyMs
                                ? formatDuration(run.latencyMs)
                                : run.startedAt && run.completedAt
                                  ? formatDuration(
                                      Math.max(
                                        0,
                                        new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime(),
                                      ),
                                    )
                                  : "—"}
                            </span>
                          </div>
                        )}
                      </Card>
                    )
                  })}

                {metadata && Object.keys(metadata).length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <Card className="p-4 rounded-xl border-primary/50 bg-primary/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Metadati della risposta</span>
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

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
