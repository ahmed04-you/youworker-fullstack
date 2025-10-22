"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { Plus, Upload, History, Settings, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useHealthSWR } from "@/lib/hooks"
import { useChatContext } from "@/lib/contexts/chat-context"
import { IngestSheet } from "@/components/shell/ingest-sheet"
import { cn } from "@/lib/utils"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"

interface NavbarProps {
  onNewChat?: () => void
}

export function Navbar({ onNewChat }: NavbarProps) {
  const [ingestOpen, setIngestOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const prefersReducedMotion = useMotionPreference()
  const { clearChat } = useChatContext()
  const { data: health, error: healthError } = useHealthSWR()

  const handleNewChat = () => {
    clearChat()
    router.push("/")
    onNewChat?.()
  }

  const navItems = [
    {
      label: "Chat",
      icon: Home,
      href: "/",
      tooltip: "Torna alla chat",
    },
    {
      label: "Cronologia",
      icon: History,
      href: "/history",
      tooltip: "Visualizza cronologia",
    },
    {
      label: "Impostazioni",
      icon: Settings,
      href: "/settings",
      tooltip: "Impostazioni",
    },
  ]

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
          className="flex h-screen w-20 flex-col items-center border-r border-border/40 bg-gradient-to-b from-card/50 to-card/30 backdrop-blur-sm"
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Primary Actions */}
          <div className="flex flex-col items-center gap-2 pt-6 pb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleNewChat}
                  className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Nuova chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Nuova chat</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIngestOpen(true)}
                  className="h-12 w-12 rounded-2xl hover:bg-accent hover:scale-105 transition-all"
                >
                  <Upload className="h-5 w-5" />
                  <span className="sr-only">Carica file</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Carica file</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator className="w-12" />

          {/* Navigation Items */}
          <nav className="flex flex-1 flex-col items-center gap-2 py-4" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className={cn(
                        "h-12 w-12 rounded-2xl transition-all hover:scale-105",
                        isActive && "bg-accent shadow-md"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.tooltip}</p>
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
                alt="YouWorker.AI"
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
                  aria-label={healthError ? "API Offline" : "API Online"}
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>API {healthError ? "Offline" : "Online"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Container>
      </TooltipProvider>

      {/* Modals */}
      <IngestSheet open={ingestOpen} onOpenChange={setIngestOpen} />
    </>
  )
}
