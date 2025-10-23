"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Activity, BarChart3, Database, MessageSquare, Settings2, TrendingUp } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9001"

const fetcher = async (url: string) => {
  const token = localStorage.getItem("auth_token")
  const res = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  })
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  error: "hsl(0, 84%, 60%)",
  chart1: "#3b82f6",
  chart2: "#10b981",
  chart3: "#f59e0b",
  chart4: "#ef4444",
  chart5: "#8b5cf6",
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30")

  const { data: overview } = useSWR(`${API_BASE_URL}/v1/analytics/overview?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: tokensTimeline } = useSWR(
    `${API_BASE_URL}/v1/analytics/tokens-timeline?days=${timeRange}&interval=day`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const { data: toolPerformance } = useSWR(`${API_BASE_URL}/v1/analytics/tool-performance?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: ingestionStats } = useSWR(`${API_BASE_URL}/v1/analytics/ingestion-stats?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: sessionActivity } = useSWR(`${API_BASE_URL}/v1/analytics/session-activity?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor your AI assistant's performance and usage</p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Metrics */}
        {overview && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.sessions.total}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.sessions.avg_per_day} avg per day
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(overview.tokens.total)}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.tokens.avg_per_message} avg per message
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tool Success Rate</CardTitle>
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.tools.success_rate}%</div>
                <p className="text-xs text-muted-foreground">
                  {overview.tools.total_runs} total runs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.documents.total}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.ingestion.total_runs} ingestion runs
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <Tabs defaultValue="tokens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tokens">Token Usage</TabsTrigger>
            <TabsTrigger value="tools">Tool Performance</TabsTrigger>
            <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          {/* Token Usage Tab */}
          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Token Usage Over Time</CardTitle>
                <CardDescription>Track your token consumption trends</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {tokensTimeline?.data && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tokensTimeline.data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatDate}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                      Input
                                    </span>
                                    <span className="font-bold text-muted-foreground">
                                      {payload[0].value?.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                      Output
                                    </span>
                                    <span className="font-bold">
                                      {payload[1].value?.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tokens_in"
                        stackId="1"
                        stroke={COLORS.chart1}
                        fill={COLORS.chart1}
                        fillOpacity={0.6}
                        name="Input Tokens"
                      />
                      <Area
                        type="monotone"
                        dataKey="tokens_out"
                        stackId="1"
                        stroke={COLORS.chart2}
                        fill={COLORS.chart2}
                        fillOpacity={0.6}
                        name="Output Tokens"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tool Performance Tab */}
          <TabsContent value="tools" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tool Success Rates</CardTitle>
                  <CardDescription>Performance by tool</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {toolPerformance?.data && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={toolPerformance.data.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="tool_name" className="text-xs" angle={-45} textAnchor="end" height={100} />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="success_rate" fill={COLORS.chart2} name="Success Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tool Latency</CardTitle>
                  <CardDescription>Average execution time (ms)</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {toolPerformance?.data && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={toolPerformance.data.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="tool_name" className="text-xs" angle={-45} textAnchor="end" height={100} />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="avg_latency_ms" fill={COLORS.chart3} name="Avg Latency (ms)" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tool Stats Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Tool Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Tool</th>
                        <th className="text-right p-2">Total Runs</th>
                        <th className="text-right p-2">Success Rate</th>
                        <th className="text-right p-2">Avg Latency</th>
                        <th className="text-right p-2">Min/Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toolPerformance?.data.map((tool: any) => (
                        <tr key={tool.tool_name} className="border-b">
                          <td className="p-2 font-medium">{tool.tool_name}</td>
                          <td className="text-right p-2">{tool.total_runs}</td>
                          <td className="text-right p-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                tool.success_rate >= 90
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : tool.success_rate >= 70
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}
                            >
                              {tool.success_rate}%
                            </span>
                          </td>
                          <td className="text-right p-2">{tool.avg_latency_ms}ms</td>
                          <td className="text-right p-2 text-muted-foreground">
                            {tool.min_latency_ms}/{tool.max_latency_ms}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ingestion Tab */}
          <TabsContent value="ingestion" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Ingestion Timeline</CardTitle>
                  <CardDescription>Files and chunks processed over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {ingestionStats?.timeline && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ingestionStats.timeline}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total_files" stroke={COLORS.chart1} name="Files" />
                        <Line type="monotone" dataKey="total_chunks" stroke={COLORS.chart2} name="Chunks" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documents by Collection</CardTitle>
                  <CardDescription>Distribution of documents</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {ingestionStats?.by_collection && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ingestionStats.by_collection}
                          dataKey="document_count"
                          nameKey="collection"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label={(entry) => `${entry.collection} (${entry.document_count})`}
                        >
                          {ingestionStats.by_collection.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Collection Stats Table */}
            <Card>
              <CardHeader>
                <CardTitle>Collection Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Collection</th>
                        <th className="text-right p-2">Documents</th>
                        <th className="text-right p-2">Total Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingestionStats?.by_collection.map((collection: any) => (
                        <tr key={collection.collection} className="border-b">
                          <td className="p-2 font-medium">{collection.collection}</td>
                          <td className="text-right p-2">{collection.document_count}</td>
                          <td className="text-right p-2">{collection.total_mb} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Session Activity</CardTitle>
                  <CardDescription>Daily session creation</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {sessionActivity?.timeline && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sessionActivity.timeline}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="session_count" fill={COLORS.chart1} name="Sessions" />
                        <Bar dataKey="tools_enabled_count" fill={COLORS.chart2} name="With Tools" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Model Usage</CardTitle>
                  <CardDescription>Sessions by model</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {sessionActivity?.by_model && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sessionActivity.by_model}
                          dataKey="session_count"
                          nameKey="model"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label={(entry) => `${entry.model} (${entry.session_count})`}
                        >
                          {sessionActivity.by_model.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
