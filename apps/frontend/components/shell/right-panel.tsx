"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { ToolRun } from "@/lib/contexts/chat-context"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"

export function RightPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { toolEvents } = useChatContext()
  const prefersReducedMotion = useMotionPreference()

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
              <h2 className="font-semibold">Cronologia strumenti</h2>
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
                        <motion.div
                          key={run.id}
                          className="w-full max-w-full"
                          initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
                          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="w-full max-w-full overflow-hidden rounded-lg border border-border/40 bg-background/50 p-2.5 shadow-sm">
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
