"use client"

import type React from "react"
import dynamic from "next/dynamic"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ui/error-boundary"
const BackgroundBeams = dynamic(
  () => import("@/components/aceternity/background-beams").then((mod) => mod.BackgroundBeams),
  {
    ssr: false,
  },
)
import { Navbar } from "@/components/shell/navbar"
import { MobileNavigationBar } from "@/components/shell/mobile-navigation"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"
import { ComposerProvider } from "@/lib/contexts/composer-context"
import { ChatProvider as ChatContextProvider } from "@/lib/contexts/chat-context"
import { ChatProvider } from "@/lib/mode"
import { I18nProvider } from "@/lib/i18n"

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const prefersReducedMotion = useMotionPreference()

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="youworker-theme">
      <ChatProvider>
        <I18nProvider>
          <ChatContextProvider>
            <ComposerProvider>
              <ErrorBoundary>
                <div className="relative flex min-h-screen overflow-hidden">
                  {!prefersReducedMotion && <BackgroundBeams className="opacity-10" />}

                  <Navbar />

                  <main className="relative z-10 flex flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
                    {children}
                  </main>

                  <MobileNavigationBar />
                  <Toaster />
                </div>
              </ErrorBoundary>
            </ComposerProvider>
          </ChatContextProvider>
        </I18nProvider>
      </ChatProvider>
    </ThemeProvider>
  )
}
