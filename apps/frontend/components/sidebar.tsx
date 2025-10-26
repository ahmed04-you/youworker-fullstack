"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  MessageSquare, 
  History, 
  BarChart3, 
  Settings, 
  Plus,
  FileUp,
  Moon,
  Sun,
  Menu,
  X
} from "lucide-react"
import { useTheme } from "next-themes"
import { apiClient, ChatSession } from "@/lib/api-client"
import { formatRelativeTime } from "@/lib/utils"

const navigation = [
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "History", href: "/history", icon: History },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Ingest", href: "/ingest", icon: FileUp },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await apiClient.getSessions()
      setSessions(data.slice(0, 5)) // Show last 5 sessions
    } catch (error) {
      console.error("Failed to load sessions:", error)
    }
  }

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-72 bg-card border-r transition-transform md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">YouWorker.AI</h1>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button className="w-full" asChild>
              <Link href="/chat">
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Link>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4">
            <ScrollArea className="h-full">
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>

              {/* Recent Sessions */}
              {sessions.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Recent Chats
                  </h3>
                  <div className="space-y-1">
                    {sessions.map((session) => (
                      <Link
                        key={session.id}
                        href={`/chat?session=${session.id}`}
                        className="block px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="font-medium truncate">{session.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRelativeTime(session.updated_at)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </nav>

          {/* Theme Toggle */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}