import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LOCAL_STORAGE_KEYS } from '@/src/lib/constants/app'

interface SettingsState {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  language: string
  defaultModelId: string
  messageHistoryLength: number
  autoScroll: boolean
  soundNotifications: boolean
  updateSettings: (updates: Partial<Omit<SettingsState, 'updateSettings' | 'resetSettings'>>) => void
  resetSettings: () => void
}

const DEFAULT_SETTINGS = {
  theme: 'dark' as const,
  fontSize: 'medium' as const,
  language: 'en',
  defaultModelId: 'gpt-oss:20b',
  messageHistoryLength: 50,
  autoScroll: true,
  soundNotifications: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (updates) => {
        set((state) => ({ ...state, ...updates }))

        // Dispatch events for theme/language changes
        if (updates.theme && typeof window !== 'undefined') {
          window.dispatchEvent(new Event('theme-change'))
        }
        if (updates.language && typeof window !== 'undefined') {
          window.dispatchEvent(new Event('language-change'))
        }
      },
      resetSettings: () => set(DEFAULT_SETTINGS)
    }),
    {
      name: LOCAL_STORAGE_KEYS.settings,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
