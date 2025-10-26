"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { MessageSquare, Zap, Clock, TrendingUp, Activity, Users } from "lucide-react"
import { apiClient, AnalyticsData } from "@/lib/api-client"

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      const data = await apiClient.getAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error("Failed to load analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  // Transform tool usage for pie chart
  const toolData = analytics?.toolUsage
    ? Object.entries(analytics.toolUsage).map(([name, count]) => ({
        name,
        value: count
      }))
    : []

  // Mock data for charts (in production, this would come from the API)
  const sessionData = [
    { date: "Mon", sessions: 12, messages: 48 },
    { date: "Tue", sessions: 19, messages: 76 },
    { date: "Wed", sessions: 15, messages: 60 },
    { date: "Thu", sessions: 22, messages: 88 },
    { date: "Fri", sessions: 18, messages: 72 },
    { date: "Sat", sessions: 25, messages: 100 },
    { date: "Sun", sessions: 20, messages: 80 },
  ]

  const tokenUsageData = [
    { hour: "00:00", tokens: 1200 },
    { hour: "04:00", tokens: 800 },
    { hour: "08:00", tokens: 2400 },
    { hour: "12:00", tokens: 3200 },
    { hour: "16:00", tokens: 2800 },
    { hour: "20:00", tokens: 1600 },
  ]

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 md:ml-72">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <Activity className="h-8 w-8 animate-spin text-primary" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 md:ml-72">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-2">
                Monitor your AI assistant's performance and usage patterns
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.totalSessions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+12%</span> from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.totalMessages || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+18%</span> from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics?.totalTokens?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+8%</span> from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Session Length</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics?.averageSessionLength?.toFixed(1) || 0} min
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-blue-600">+5%</span> from last week
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Session Activity</CardTitle>
                    <CardDescription>Daily sessions and messages over the last week</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sessionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sessions" fill="#3b82f6" name="Sessions" />
                        <Bar dataKey="messages" fill="#8b5cf6" name="Messages" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Token Usage by Hour</CardTitle>
                    <CardDescription>Token consumption throughout the day</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={tokenUsageData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="tokens" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          name="Tokens"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tools" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tool Usage Distribution</CardTitle>
                      <CardDescription>Most frequently used tools</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={toolData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {toolData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tool Statistics</CardTitle>
                      <CardDescription>Detailed tool usage metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {toolData.map((tool, index) => (
                          <div key={tool.name} className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-3" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{tool.name}</span>
                                <span className="text-sm text-muted-foreground">{tool.value} calls</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}