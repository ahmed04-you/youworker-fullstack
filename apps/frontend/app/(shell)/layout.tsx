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
import { Navbar } from "@/components/shell/navbar"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { ComposerProvider } from "@/lib/contexts/composer-context"
import { ChatProvider as ChatContextProvider } from "@/lib/contexts/chat-context"
import { ChatProvider } from "@/lib/mode"

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const prefersReducedMotion = useMotionPreference()

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="youworker-theme">
      <ChatProvider>
        <ChatContextProvider>
          <ComposerProvider>
            <div className="relative flex h-screen overflow-hidden">
              {!prefersReducedMotion && <BackgroundBeams className="opacity-10" />}

              <Navbar />

              <main className="relative z-10 flex-1 flex flex-col overflow-hidden">{children}</main>

              <Toaster />
            </div>
          </ComposerProvider>
        </ChatContextProvider>
      </ChatProvider>
    </ThemeProvider>
  )
}
