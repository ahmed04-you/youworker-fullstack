"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Code,
  Database,
  FileText,
  Globe,
  Search,
  Sparkles,
  Terminal,
  Wrench,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { ToolRun } from "@/lib/contexts/chat-context"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"

export function RightPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedArgs, setExpandedArgs] = useState<Set<string>>(new Set())
  const { toolEvents } = useChatContext()
  const prefersReducedMotion = useMotionPreference()

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
    { icon: JSX.Element; className: string; label: string; accent: string }
  > = {
    running: {
      icon: <Clock className="h-4 w-4 text-sky-500 animate-pulse" />,
      className: "border-sky-500/40 text-sky-500 bg-sky-500/10",
      label: "In esecuzione",
      accent: "from-sky-500/25 to-sky-500/0",
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
      label: "Completato",
      accent: "from-emerald-500/25 to-emerald-500/0",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-rose-500" />,
      className: "border-rose-500/40 text-rose-500 bg-rose-500/10",
      label: "Errore",
      accent: "from-rose-500/25 to-rose-500/0",
    },
    cached: {
      icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      className: "border-purple-500/40 text-purple-500 bg-purple-500/10",
      label: "Cache",
      accent: "from-purple-500/25 to-purple-500/0",
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

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <motion.aside
      initial={{ x: 300, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? "56px" : "360px",
      }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      className={cn(
        "hidden h-screen flex-col border-l border-border/40 bg-card/40 backdrop-blur-sm lg:flex",
        isCollapsed ? "items-center" : "",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 p-4">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center gap-2"
            >
              <Wrench className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Cronolgia tool</h2>
              {toolEvents.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {toolEvents.length}
                </Badge>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform", isCollapsed ? "rotate-180" : "")} />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <ScrollArea className="flex-1 h-full px-4 py-3">
              <div className="flex max-w-full flex-col space-y-3">
                {toolEvents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <Wrench className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>Nessun evento strumento</p>
                  </div>
                ) : (
                  toolEvents
                    .slice()
                    .reverse()
                    .map((run) => {
                      const ToolIcon = getToolIcon(run.tool)
                      const isExpanded = expandedArgs.has(run.id)
                      const hasArgs = run.args && Object.keys(run.args).length > 0
                      const argsString = hasArgs ? JSON.stringify(run.args) : ""
                      const truncatedArgs = argsString.length > 70 ? `${argsString.slice(0, 70)}…` : argsString
                      const statusMeta = runStatusStyles[run.status]

                      return (
                        <motion.div
                          key={run.id}
                          className="w-full max-w-full"
                          initial={prefersReducedMotion ? {} : { opacity: 0, x: 20, scale: 0.98 }}
                          animate={prefersReducedMotion ? {} : { opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: 0.05, type: "spring", stiffness: 280, damping: 26 }}
                        >
                          <Card className="relative w-full max-w-full overflow-hidden rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm">
                            {!prefersReducedMotion && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r opacity-70",
                                  statusMeta.accent,
                                )}
                              />
                            )}
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
                              <Badge
                                className={cn("flex-shrink-0 items-center gap-1 text-[0.65rem]", statusMeta.className)}
                              >
                                {statusMeta.icon}
                                {statusMeta.label}
                              </Badge>
                            </div>

                            {hasArgs && (
                              <div className="mt-2 rounded-xl border border-border/40 bg-muted/40 p-2 text-xs font-mono text-muted-foreground">
                                {isExpanded ? (
                                  <pre className="max-h-48 whitespace-pre-wrap break-all text-muted-foreground">
                                    {JSON.stringify(run.args, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="truncate">{truncatedArgs}</div>
                                )}
                                {argsString.length > 70 && (
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
                        </motion.div>
                      )
                    })
                )}
              </div>
            </ScrollArea>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
