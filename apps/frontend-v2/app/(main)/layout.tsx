import { AppShell } from '@/src/components/layout/AppShell'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      {children}
    </AppShell>
  )
}
