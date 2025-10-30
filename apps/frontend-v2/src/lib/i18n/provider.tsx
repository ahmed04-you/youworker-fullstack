'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, i18n as i18nConfig } from './config'
import { errorTracker } from '@/src/lib/utils'

type Messages = Record<string, string | Messages>

interface I18nContextType {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

async function loadMessages(locale: Locale): Promise<Messages> {
  try {
    const messages = await import(`../../../locales/${locale}.json`)
    return messages.default
  } catch (error) {
    errorTracker.captureError(error as Error, {
      component: 'I18nProvider',
      action: 'loadMessages',
      metadata: { locale }
    })
    // Fallback to English
    const messages = await import(`../../../locales/en.json`)
    return messages.default
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(i18nConfig.defaultLocale)
  const [messages, setMessages] = useState<Messages>({})

  useEffect(() => {
    // Load saved locale from settings
    const loadLocale = () => {
      if (typeof window !== 'undefined') {
        try {
          const settings = JSON.parse(localStorage.getItem('settings') || '{}')
          const savedLocale = settings.language || i18nConfig.defaultLocale
          if (i18nConfig.locales.includes(savedLocale as Locale)) {
            setLocaleState(savedLocale as Locale)
          }
        } catch (error) {
          errorTracker.captureError(error as Error, {
            component: 'I18nProvider',
            action: 'loadLocale'
          })
        }
      }
    }

    loadLocale()

    // Listen for language change events
    window.addEventListener('language-change', loadLocale)

    return () => {
      window.removeEventListener('language-change', loadLocale)
    }
  }, [])

  useEffect(() => {
    loadMessages(locale).then(setMessages)
  }, [locale])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: string | Messages = messages

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key // Return key if translation not found
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Replace parameters
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param]?.toString() || match
      })
    }

    return value
  }

  return (
    <I18nContext.Provider value={{ locale, messages, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslations() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslations must be used within I18nProvider')
  }
  return context.t
}

export function useLocale() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useLocale must be used within I18nProvider')
  }
  return { locale: context.locale, setLocale: context.setLocale }
}
