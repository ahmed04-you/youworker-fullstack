"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { readFromStorage, saveToStorage } from "@/lib/utils"

const STORAGE_KEY = "youworker.settings.v1"

interface StoredSettings {
  expectAudio: boolean
}

interface ChatSettingsContextValue {
  expectAudio: boolean
  setExpectAudio: (value: boolean) => void
  toggleExpectAudio: () => void
}

const DEFAULT_SETTINGS: StoredSettings = {
  expectAudio: true,
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [expectAudio, setExpectAudioState] = useState(DEFAULT_SETTINGS.expectAudio)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = readFromStorage<StoredSettings>(STORAGE_KEY, DEFAULT_SETTINGS)
    setExpectAudioState(stored.expectAudio)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveToStorage(STORAGE_KEY, { expectAudio })
  }, [expectAudio, hydrated])

  const value = useMemo<ChatSettingsContextValue>(
    () => ({
      expectAudio,
      setExpectAudio: setExpectAudioState,
      toggleExpectAudio: () => setExpectAudioState((prev) => !prev),
    }),
    [expectAudio],
  )

  return <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>
}

export function useChatSettings() {
  const ctx = useContext(ChatSettingsContext)
  if (!ctx) {
    throw new Error("useChatSettings must be used within a ChatProvider")
  }
  return ctx
}
