"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Database,
  FileText,
  Sparkles,
  Globe,
  Terminal,
  Wrench,
  Search,
  XCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { ToolRun } from "@/lib/contexts/chat-context"

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
    icon: <BadgeCheck className="h-4 w-4 text-emerald-500" />,
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
      return <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
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

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function ToolEventsPanel() {
  const { toolEvents } = useChatContext()
  const [expandedArgs, setExpandedArgs] = useState<Set<string>>(new Set())

  const toggleArgExpansion = (id: string) => {
    setExpandedArgs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Card className="flex h-full flex-col rounded-2xl border border-border/40 bg-background/70 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="h-4 w-4 text-primary" />
          Cronolgia tool
        </div>
        {toolEvents.length > 0 && (
          <Badge variant="secondary" className="rounded-full">
            {toolEvents.length}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3 flex flex-col">
          {toolEvents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Wrench className="mx-auto mb-3 h-8 w-8 opacity-50" />
              Nessun evento strumento
            </div>
          ) : (
            toolEvents
              .slice()
              .reverse()
              .map((run) => {
                const ToolIcon = getToolIcon(run.tool)
                const statusMeta = runStatusStyles[run.status]
                const hasArgs = run.args && Object.keys(run.args).length > 0
                const argsString = hasArgs ? JSON.stringify(run.args) : ""
                const truncatedArgs = argsString.length > 60 ? `${argsString.slice(0, 60)}…` : argsString
                const isExpanded = expandedArgs.has(run.id)

                return (
                  <motion.div
                    key={run.id}
                    className="w-full max-w-full"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="w-full max-w-full overflow-hidden rounded-2xl border border-border/40 bg-card/70 p-3 shadow-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-xl border border-border/40 bg-muted/40">
                            <ToolIcon className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 truncate">
                            <p className="truncate text-sm font-semibold leading-tight">{run.tool}</p>
                            {run.server && (
                              <p className="truncate text-xs leading-tight text-muted-foreground">Server · {run.server}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={cn("flex-shrink-0 items-center gap-1 text-[0.65rem]", statusMeta.className)}>
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
                        <AnimatePresence initial={false}>
                          {run.updates.map((update) => (
                            <motion.div
                              key={update.id}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground"
                            >
                              <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted/50">
                                {getUpdateIcon(update.status)}
                              </span>
                              <span className="min-w-0 truncate font-medium">{getUpdateLabel(update.status)}</span>
                              <span className="ml-auto text-[0.65rem] text-muted-foreground/80">
                                {update.ts ? new Date(update.ts).toLocaleTimeString() : "—"}
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      {(run.latencyMs || (run.startedAt && run.completedAt)) && (
                        <div className="mt-3 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                          <span>Durata</span>
                          <span className="font-medium text-foreground">
                            {run.latencyMs
                              ? formatDuration(run.latencyMs)
                              : run.startedAt && run.completedAt
                                ? formatDuration(
                                    Math.max(0, new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()),
                                  )
                                : "—"}
                          </span>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              })
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}
