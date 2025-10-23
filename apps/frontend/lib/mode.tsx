"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { readFromStorage, saveToStorage } from "@/lib/utils"

const STORAGE_KEY = "youworker.settings.v1"

export const ASSISTANT_LANGUAGE_OPTIONS = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
] as const

export const UI_LANGUAGE_OPTIONS = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
] as const

type AssistantLanguage = (typeof ASSISTANT_LANGUAGE_OPTIONS)[number]["value"]
type InterfaceLanguage = (typeof UI_LANGUAGE_OPTIONS)[number]["value"]

interface StoredSettings {
  expectAudio: boolean
  assistantLanguage: AssistantLanguage
  uiLanguage: InterfaceLanguage
}

interface ChatSettingsContextValue {
  expectAudio: boolean
  setExpectAudio: (value: boolean) => void
  toggleExpectAudio: () => void
  assistantLanguage: AssistantLanguage
  setAssistantLanguage: (value: AssistantLanguage | string) => void
  uiLanguage: InterfaceLanguage
  setUiLanguage: (value: InterfaceLanguage | string) => void
}

const DEFAULT_SETTINGS: StoredSettings = {
  expectAudio: true,
  assistantLanguage: "it",
  uiLanguage: "it",
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | undefined>(undefined)

function normalizeAssistantLanguage(value: string | undefined): AssistantLanguage {
  const fallback = DEFAULT_SETTINGS.assistantLanguage
  if (!value) {
    return fallback
  }
  const normalized = value.trim().toLowerCase()
  return (ASSISTANT_LANGUAGE_OPTIONS.find((item) => item.value === normalized)?.value ??
    fallback) as AssistantLanguage
}

function normalizeInterfaceLanguage(value: string | undefined): InterfaceLanguage {
  const fallback = DEFAULT_SETTINGS.uiLanguage
  if (!value) {
    return fallback
  }
  const normalized = value.trim().toLowerCase()
  return (UI_LANGUAGE_OPTIONS.find((item) => item.value === normalized)?.value ?? fallback) as InterfaceLanguage
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [expectAudio, setExpectAudioState] = useState(DEFAULT_SETTINGS.expectAudio)
  const [assistantLanguage, setAssistantLanguageState] = useState<AssistantLanguage>(
    DEFAULT_SETTINGS.assistantLanguage,
  )
  const [uiLanguage, setUiLanguageState] = useState<InterfaceLanguage>(DEFAULT_SETTINGS.uiLanguage)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = readFromStorage<StoredSettings>(STORAGE_KEY, DEFAULT_SETTINGS)
    setExpectAudioState(stored.expectAudio)
    setAssistantLanguageState(normalizeAssistantLanguage(stored.assistantLanguage))
    setUiLanguageState(normalizeInterfaceLanguage(stored.uiLanguage ?? stored.assistantLanguage))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveToStorage(STORAGE_KEY, { expectAudio, assistantLanguage, uiLanguage })
  }, [assistantLanguage, expectAudio, hydrated, uiLanguage])

  const value = useMemo<ChatSettingsContextValue>(
    () => ({
      expectAudio,
      setExpectAudio: setExpectAudioState,
      toggleExpectAudio: () => setExpectAudioState((prev) => !prev),
      assistantLanguage,
      setAssistantLanguage: (next) => setAssistantLanguageState(normalizeAssistantLanguage(next)),
      uiLanguage,
      setUiLanguage: (next) => setUiLanguageState(normalizeInterfaceLanguage(next)),
    }),
    [assistantLanguage, expectAudio, uiLanguage],
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
