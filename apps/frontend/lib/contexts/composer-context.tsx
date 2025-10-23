"use client"

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react"

interface ComposerContextValue {
  composerElement: HTMLTextAreaElement | null
  registerComposer: (element: HTMLTextAreaElement | null) => void
  focusComposer: () => void
}

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined)

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [composerElement, setComposerElement] = useState<HTMLTextAreaElement | null>(null)
  const focusTimeoutRef = useRef<number | null>(null)

  const value = useMemo<ComposerContextValue>(
    () => ({
      composerElement,
      registerComposer: (element) => {
        if (focusTimeoutRef.current) {
          window.clearTimeout(focusTimeoutRef.current)
          focusTimeoutRef.current = null
        }
        setComposerElement(element)
      },
      focusComposer: () => {
        if (!composerElement) return
        focusTimeoutRef.current = window.setTimeout(() => {
          composerElement.focus()
          focusTimeoutRef.current = null
        }, 0)
      },
    }),
    [composerElement],
  )

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>
}

export function useComposerContext() {
  const ctx = useContext(ComposerContext)
  if (!ctx) {
    throw new Error("useComposerContext must be used within a ComposerProvider")
  }
  return ctx
}
