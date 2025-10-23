"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { Plus, Upload, History, Settings, Home, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useHealthSWR } from "@/lib/hooks"
import { useChatContext } from "@/lib/contexts/chat-context"
import { cn } from "@/lib/utils"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { useI18n } from "@/lib/i18n"

interface NavbarProps {
  onNewChat?: () => void
}

export function Navbar({ onNewChat }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const prefersReducedMotion = useMotionPreference()
  const { clearChat } = useChatContext()
  const { data: health, error: healthError } = useHealthSWR()
  const isIngest = pathname === "/ingest"
  const { t } = useI18n()
  
  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const navItemsRef = useRef<(HTMLElement | null)[]>([])
  
  // Handle keyboard navigation
  const moveFocus = (delta: number) => {
    const items = navItemsRef.current.filter(
      (item): item is HTMLElement => item !== null,
    )
    if (!items.length) return

    const activeElement = document.activeElement as HTMLElement | null
    const activeIndex = activeElement
      ? items.findIndex((item) => item === activeElement || item.contains(activeElement))
      : -1

    const currentIndex = activeIndex >= 0 ? activeIndex : focusedIndex
    const baseIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (baseIndex + delta + items.length) % items.length

    items[nextIndex]?.focus()
    setFocusedIndex(nextIndex)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!navItemsRef.current.length) {
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveFocus(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveFocus(-1)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setFocusedIndex(-1)
    }
  }

  const handleNewChat = () => {
    clearChat()
    router.push("/")
    onNewChat?.()
  }

  const navItems = [
    {
      labelKey: "nav.chat",
      icon: Home,
      href: "/",
    },
    {
      labelKey: "nav.history",
      icon: History,
      href: "/history",
    },
    {
      labelKey: "nav.analytics",
      icon: BarChart3,
      href: "/analytics",
    },
    {
      labelKey: "nav.settings",
      icon: Settings,
      href: "/settings",
    },
  ] as const

  const Container = prefersReducedMotion ? "aside" : motion.aside

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Container
          {...(!prefersReducedMotion && {
            initial: { x: -80, opacity: 0 },
            animate: { x: 0, opacity: 1 },
            transition: { duration: 0.3, ease: "easeOut" },
          })}
          className="hidden h-screen w-20 flex-col items-center border-r border-border/40 bg-gradient-to-b from-card/50 to-card/30 backdrop-blur-sm lg:flex"
          role="navigation"
          aria-label="Main navigation"
          onKeyDown={handleKeyDown}
        >
          {/* Primary Actions */}
          <div className="flex flex-col items-center gap-2 pt-6 pb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleNewChat}
                  className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  ref={el => { if (el) navItemsRef.current[0] = el }}
                  onFocus={() => setFocusedIndex(0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNewChat()
                    }
                  }}
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">{t("nav.new_chat")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{t("nav.new_chat")}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/ingest")}
                  className={cn(
                    "h-12 w-12 rounded-2xl transition-all hover:scale-105 focus:ring-2 focus:ring-accent focus:ring-offset-2",
                    isIngest ? "bg-accent shadow-md" : "hover:bg-accent",
                  )}
                  ref={el => { if (el) navItemsRef.current[1] = el }}
                  onFocus={() => setFocusedIndex(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push("/ingest")
                    }
                  }}
                >
                  <Upload className="h-5 w-5" />
                  <span className="sr-only">{t("nav.upload")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{t("nav.upload")}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator className="w-12" />

          {/* Navigation Items */}
          <nav className="flex flex-1 flex-col items-center gap-2 py-4" aria-label="Main navigation">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className={cn(
                        "h-12 w-12 rounded-2xl transition-all hover:scale-105 focus:ring-2 focus:ring-accent focus:ring-offset-2",
                        isActive && "bg-accent shadow-md"
                      )}
                      ref={el => { if (el) navItemsRef.current[2 + index] = el }}
                      onFocus={() => setFocusedIndex(2 + index)}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{t(item.labelKey)}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{t(item.labelKey)}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="mt-auto flex flex-col items-center gap-3 pb-6">
            <Separator className="w-12" />
            <Link href="/" className="group relative">
              <motion.div
                className="absolute -inset-2 rounded-2xl bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"
                initial={false}
              />
              <Image
                src="/youco-logo.png"
                alt={t("chat.title")}
                width={48}
                height={48}
                priority
                className="relative rounded-xl transition-transform group-hover:scale-110"
              />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    healthError
                      ? "bg-rose-500 animate-pulse"
                      : "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  )}
                aria-label={healthError ? t("nav.api_status.offline") : t("nav.api_status.online")}
              />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{healthError ? t("nav.api_status.offline") : t("nav.api_status.online")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        </Container>
      </TooltipProvider>
    </>
  )
}
