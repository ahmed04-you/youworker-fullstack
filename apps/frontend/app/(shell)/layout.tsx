"use client"

import type React from "react"
import dynamic from "next/dynamic"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
const BackgroundBeams = dynamic(
  () => import("@/components/aceternity/background-beams").then((mod) => mod.BackgroundBeams),
  {
    ssr: false,
  },
)
import { RightPanel } from "@/components/shell/right-panel"
import { MobileToolSheet } from "@/components/shell/mobile-tool-sheet"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { ComposerProvider } from "@/lib/contexts/composer-context"
import { ChatProvider } from "@/lib/contexts/chat-context"
import { ModeProvider } from "@/lib/mode"

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const prefersReducedMotion = useMotionPreference()

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="youworker-theme">
      <ModeProvider>
        <ChatProvider>
          <ComposerProvider>
            <div className="relative flex h-screen overflow-hidden">
              {!prefersReducedMotion && <BackgroundBeams className="opacity-10" />}

              <main className="relative z-10 flex-1 flex flex-col overflow-hidden">{children}</main>

              <RightPanel />
              <MobileToolSheet />

              <Toaster />
            </div>
          </ComposerProvider>
        </ChatProvider>
      </ModeProvider>
    </ThemeProvider>
  )
}
