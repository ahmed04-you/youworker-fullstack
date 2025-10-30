import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './theme-provider'
import { I18nProvider } from '@/src/lib/i18n/provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YouWorker AI - Private AI Assistant',
  description: 'Privacy-focused AI assistant with local document processing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const settings = JSON.parse(localStorage.getItem('settings') || '{}');
                const theme = settings.theme || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <I18nProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
