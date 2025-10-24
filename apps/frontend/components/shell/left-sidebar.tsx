"use client"

import type React from "react"

import { useState, useMemo, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import { Plus, Search, MessageSquare, Upload, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useLocalThreads, useHealthSWR } from "@/lib/hooks"
import { useChatContext } from "@/lib/contexts/chat-context"
import { useComposerContext } from "@/lib/contexts/composer-context"
import { ThreadListSkeleton } from "@/components/chat/thread-list-skeleton"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { useI18n } from "@/lib/i18n"

const quickLinks = [
  { titleKey: "nav.new_chat", icon: Plus, href: "/" },
  { titleKey: "nav.upload", icon: Upload, href: "/ingest" },
]

export function LeftSidebar() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const pathname = usePathname()
  const prefersReducedMotion = useMotionPreference()
  const { t } = useI18n()

  const { threads, activeThreadId, setActiveThreadId, createThread, deleteThread } = useLocalThreads()
  const { data: health, error: healthError } = useHealthSWR()
  const { clearChat } = useChatContext()
  const { focusComposer } = useComposerContext()

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads
    const query = searchQuery.toLowerCase()
    return threads.filter((thread) => thread.title.toLowerCase().includes(query))
  }, [threads, searchQuery])

  const handleNewChat = useCallback(() => {
    const newThread = createThread()
    clearChat()
    setActiveThreadId(newThread.id)
    focusComposer()
  }, [createThread, clearChat, setActiveThreadId, focusComposer])

  const handleThreadSelect = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId)
      focusComposer()
    },
    [setActiveThreadId, focusComposer],
  )

  const handleThreadDelete = useCallback(
    (threadId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      deleteThread(threadId)
      if (activeThreadId === threadId) {
        clearChat()
      }
    },
    [deleteThread, activeThreadId, clearChat],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredThreads.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && filteredThreads[selectedIndex]) {
        e.preventDefault()
        handleThreadSelect(filteredThreads[selectedIndex].id)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filteredThreads, selectedIndex, handleThreadSelect])

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Proprio ora"
    if (diffMins < 60) return `${diffMins} min fa`
    if (diffHours < 24) return `${diffHours} h fa`
    if (diffDays < 7) return `${diffDays} g fa`
    return date.toLocaleDateString("it-IT")
  }

  const Container = prefersReducedMotion ? "aside" : motion.aside
  const statusBadgeClasses = cn(
    "rounded-md px-2 py-0.5 text-xs font-medium",
    healthError ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  )
  const statusText = healthError ? "Auth/Offline" : "Online"

  return (
    <>
      <Container
        {...(!prefersReducedMotion && {
          initial: { x: -300, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          transition: { duration: 0.3, ease: "easeOut" },
        })}
        className="flex h-screen w-64 flex-col border-r border-border/50 bg-card/30 backdrop-blur-sm"
        role="complementary"
        aria-label="Navigazione laterale"
      >
        {/* Thread List with Search */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder={t("history.placeholder.search") || "Cerca conversazioni..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl pl-9"
                aria-label={t("history.placeholder.search") || "Cerca conversazioni"}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 h-full px-3 py-2" role="list" aria-label="Elenco conversazioni">
            {!isHydrated ? (
              <ThreadListSkeleton />
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mb-2 h-8 w-8 opacity-50" aria-hidden="true" />
                <p>{searchQuery ? (t("history.empty.search_results") || "Nessuna conversazione trovata") : (t("history.empty.sessions.title") || "Ancora nessuna conversazione")}</p>
                <p className="text-xs">{t("history.empty.sessions.description") || "Avvia una nuova chat per iniziare"}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredThreads.map((thread, index) => {
                  const isActive = thread.id === activeThreadId
                  const isSelected = index === selectedIndex
                  const lastMessage = thread.messages[thread.messages.length - 1]
                  const preview = lastMessage?.content.slice(0, 60) || "Ancora nessun messaggio"

                  const ButtonContainer = prefersReducedMotion ? "button" : motion.button

                  return (
                    <DropdownMenu key={thread.id}>
                      <DropdownMenuTrigger asChild>
                        <ButtonContainer
                          {...(!prefersReducedMotion && {
                            initial: { opacity: 0, y: 10 },
                            animate: { opacity: 1, y: 0 },
                            transition: { delay: index * 0.03 },
                          })}
                          onClick={() => handleThreadSelect(thread.id)}
                          className={cn(
                            "w-full rounded-xl p-3 text-left transition-colors",
                            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
                            isActive && "bg-accent",
                            isSelected && "ring-2 ring-primary/30",
                          )}
                          role="listitem"
                          aria-label={`Conversazione: ${thread.title}`}
                          aria-current={isActive ? "true" : undefined}
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <h3 className="line-clamp-1 text-sm font-medium">{thread.title}</h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(thread.updatedAt)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
                        </ButtonContainer>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleThreadDelete(thread.id, e as any)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t("history.action.delete") || "Elimina conversazione"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator className="bg-border/50" />

        {/* Quick Links Footer */}
        <nav className="p-3 space-y-1" aria-label="Collegamenti rapidi">
          {quickLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Button
                key={link.href}
                variant="ghost"
                className={cn("w-full justify-start gap-2 rounded-xl", isActive && "bg-accent")}
                asChild
              >
                <Link href={link.href} aria-current={isActive ? "page" : undefined}>
                  <link.icon className="h-4 w-4" aria-hidden="true" />
                  {t(link.titleKey as any)}
                </Link>
              </Button>
            )
          })}
        </nav>

        {/* Product Mark + API status */}
        <div className="border-t border-border/50 px-3 pb-4 pt-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3">
            <Image src="/youco-logo.png" alt="YouCo logo" width={48} height={24} priority />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{t("chat.title")}</span>
              <span className="text-xs text-muted-foreground">{t("nav.api_status.online") || "Stato API"}</span>
            </div>
            <span className={statusBadgeClasses}>{statusText}</span>
          </div>
        </div>
      </Container>

    </>
  )
}
