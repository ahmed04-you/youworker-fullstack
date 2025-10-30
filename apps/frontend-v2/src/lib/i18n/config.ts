export const i18n = {
  locales: ['en', 'es', 'fr', 'de', 'zh', 'it'],
  defaultLocale: 'en',
} as const

export type Locale = (typeof i18n.locales)[number]

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  it: 'Italiano',
}
