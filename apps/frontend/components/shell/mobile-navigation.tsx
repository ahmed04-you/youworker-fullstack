"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { History, MessageSquare, Settings, Upload, BarChart3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const MOBILE_ROUTES = [
  { href: "/", icon: MessageSquare, key: "mobile.nav.chat" },
  { href: "/ingest", icon: Upload, key: "mobile.nav.ingest" },
  { href: "/history", icon: History, key: "mobile.nav.history" },
  { href: "/analytics", icon: BarChart3, key: "mobile.nav.analytics" },
  { href: "/settings", icon: Settings, key: "mobile.nav.settings" },
] as const

export function MobileNavigationBar() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/40 bg-background/90 backdrop-blur-md lg:hidden">
      <ul className="grid grid-cols-5 gap-1 px-2 py-3">
        {MOBILE_ROUTES.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} aria-hidden="true" />
                <span>{t(item.key as any)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
