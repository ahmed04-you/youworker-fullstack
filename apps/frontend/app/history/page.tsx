"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Trash2, MessageSquare, Calendar, Clock } from "lucide-react"
import { apiClient, ChatSession } from "@/lib/api-client"
import { formatRelativeTime, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = sessions.filter(session =>
        session.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredSessions(filtered)
    } else {
      setFilteredSessions(sessions)
    }
  }, [searchQuery, sessions])

  const loadSessions = async () => {
    try {
      const data = await apiClient.getSessions()
      setSessions(data)
      setFilteredSessions(data)
    } catch (error) {
      console.error("Failed to load sessions:", error)
      toast.error("Failed to load chat history")
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await apiClient.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      toast.success("Session deleted successfully")
    } catch (error) {
      console.error("Failed to delete session:", error)
      toast.error("Failed to delete session")
    }
  }

  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const groups: Record<string, ChatSession[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'This Month': [],
      'Older': []
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    sessions.forEach(session => {
      const sessionDate = new Date(session.updated_at)
      if (sessionDate >= today) {
        groups['Today'].push(session)
      } else if (sessionDate >= yesterday) {
        groups['Yesterday'].push(session)
      } else if (sessionDate >= weekAgo) {
        groups['This Week'].push(session)
      } else if (sessionDate >= monthAgo) {
        groups['This Month'].push(session)
      } else {
        groups['Older'].push(session)
      }
    })

    return groups
  }

  const groupedSessions = groupSessionsByDate(filteredSessions)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 md:ml-72">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Chat History</h1>
              <p className="text-muted-foreground mt-2">
                Browse and manage your previous conversations
              </p>
            </div>

            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Session Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sessions.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {groupedSessions['Today'].length + groupedSessions['Yesterday'].length + groupedSessions['This Week'].length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {sessions.reduce((sum, s) => sum + s.message_count, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions List */}
            <Card>
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
                <CardDescription>
                  {filteredSessions.length} conversation{filteredSessions.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {Object.entries(groupedSessions).map(([period, periodSessions]) => (
                    periodSessions.length > 0 && (
                      <div key={period} className="mb-6">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">{period}</h3>
                        <div className="space-y-2">
                          {periodSessions.map((session) => (
                            <div
                              key={session.id}
                              className={cn(
                                "group flex items-center justify-between p-4 border rounded-lg transition-colors hover:bg-accent cursor-pointer",
                                selectedSession === session.id && "bg-accent"
                              )}
                              onClick={() => setSelectedSession(session.id)}
                            >
                              <Link href={`/chat?session=${session.id}`} className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{session.title}</div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span>{session.message_count} messages</span>
                                      <span>•</span>
                                      <span>{formatRelativeTime(session.updated_at)}</span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteSession(session.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                  
                  {filteredSessions.length === 0 && (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No conversations found</h3>
                      <p className="text-muted-foreground">
                        {searchQuery ? "Try a different search term" : "Start a new chat to begin"}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}