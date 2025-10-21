"use client"

import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  Wrench,
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
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { ToolRun } from "@/lib/contexts/chat-context"

const runStatusStyles: Record<
  ToolRun["status"],
  { icon: JSX.Element; className: string; label: string }
> = {
  running: {
    icon: <Clock className="h-3.5 w-3.5 text-sky-500 animate-pulse" />,
    className: "border-sky-500/40 text-sky-500 bg-sky-500/10",
    label: "In esecuzione",
  },
  success: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
    label: "Completato",
  },
  error: {
    icon: <XCircle className="h-3.5 w-3.5 text-rose-500" />,
    className: "border-rose-500/40 text-rose-500 bg-rose-500/10",
    label: "Errore",
  },
  cached: {
    icon: <Sparkles className="h-3.5 w-3.5 text-purple-500" />,
    className: "border-purple-500/40 text-purple-500 bg-purple-500/10",
    label: "Cache",
  },
}

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

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function ToolEventsPanel() {
  const { toolEvents } = useChatContext()

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
                const duration = run.latencyMs
                  ? formatDuration(run.latencyMs)
                  : run.startedAt && run.completedAt
                    ? formatDuration(
                        Math.max(0, new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()),
                      )
                    : null

                return (
                  <motion.div
                    key={run.id}
                    className="w-full max-w-full"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
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
    </Card>
  )
}
