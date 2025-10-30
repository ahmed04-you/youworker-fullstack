'use client'

import { useState, useEffect } from 'react'
import { UserSettings } from '@/src/lib/types'
import { getDefaultModel } from '@/src/lib/data/models'

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  fontSize: 'medium',
  language: 'en',
  defaultModelId: getDefaultModel().id,
  messageHistoryLength: 50,
  autoScroll: true,
  soundNotifications: false
}

function getSettingsFromStorage(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const stored = localStorage.getItem('settings')
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('Failed to load settings from storage:', error)
  }

  return DEFAULT_SETTINGS
}

function saveSettingsToStorage(settings: UserSettings) {
  try {
    localStorage.setItem('settings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings to storage:', error)
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadedSettings = getSettingsFromStorage()
    setSettings(loadedSettings)
    setLoading(false)
  }, [])

  const updateSettings = (updates: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...updates }
    setSettings(updatedSettings)
    saveSettingsToStorage(updatedSettings)

    // Dispatch theme-change event if theme was updated
    if (updates.theme && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('theme-change'))
    }

    // Dispatch language-change event if language was updated
    if (updates.language && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('language-change'))
    }
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    saveSettingsToStorage(DEFAULT_SETTINGS)
  }

  const clearChatHistory = () => {
    try {
      // Clear chat sessions from storage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('chat_') || key === 'chatSessions')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      return true
    } catch (error) {
      console.error('Failed to clear chat history:', error)
      return false
    }
  }

  const exportData = () => {
    try {
      const data = {
        settings,
        user: localStorage.getItem('user'),
        timestamp: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `youworker-data-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      return true
    } catch (error) {
      console.error('Failed to export data:', error)
      return false
    }
  }

  return {
    settings,
    loading,
    updateSettings,
    resetSettings,
    clearChatHistory,
    exportData
  }
}
