"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Activity, Database, MessageSquare, Settings2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n"

import { getApiBaseUrl, apiFetch } from "@/lib/api"

const fetcher = async (url: string) => {
  // Use the centralized API fetch function that handles authentication properly
  return apiFetch(url.replace(/^https?:\/\/[^\/]+/, ""))
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
  const { t } = useI18n()

  const { data: overview } = useSWR(`/v1/analytics/overview?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: tokensTimeline } = useSWR(
    `/v1/analytics/tokens-timeline?days=${timeRange}&interval=day`,
    fetcher,
    { refreshInterval: 30000 },
  )

  const { data: toolPerformance } = useSWR(`/v1/analytics/tool-performance?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: ingestionStats } = useSWR(`/v1/analytics/ingestion-stats?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const { data: sessionActivity } = useSWR(`/v1/analytics/session-activity?days=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("default", { month: "short", day: "numeric" })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="container mx-auto flex min-h-full flex-col p-6 py-8">
      <div className="flex-1 rounded-2xl border-border/50 bg-card/50 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">{t("nav.analytics")}</h1>
              <p className="text-sm text-muted-foreground">{t("analytics.header.description")}</p>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                aria-label={t("analytics.time_range.label")}
                className="min-w-[12rem] rounded-xl"
              >
                <SelectValue placeholder={t("analytics.time_range.placeholder")} />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                <SelectItem value="7">{t("analytics.time_range.last_7")}</SelectItem>
                <SelectItem value="30">{t("analytics.time_range.last_30")}</SelectItem>
                <SelectItem value="90">{t("analytics.time_range.last_90")}</SelectItem>
                <SelectItem value="365">{t("analytics.time_range.last_365")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {overview && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">{t("analytics.overview.sessions.title")}</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.sessions.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.overview.sessions.description", {
                      value: overview.sessions.avg_per_day.toLocaleString(),
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">{t("analytics.overview.tokens.title")}</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(overview.tokens.total)}</div>
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.overview.tokens.description", {
                      value: overview.tokens.avg_per_message.toLocaleString(),
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">{t("analytics.overview.tools.title")}</CardTitle>
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.tools.success_rate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.overview.tools.description", {
                      value: overview.tools.total_runs.toLocaleString(),
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">{t("analytics.overview.documents.title")}</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.documents.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {t("analytics.overview.documents.description", {
                      value: overview.ingestion.total_runs.toLocaleString(),
                    })}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="tokens" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 gap-2 rounded-2xl bg-muted/40 p-1">
              <TabsTrigger
                value="tokens"
                className="rounded-xl text-center text-sm leading-5 whitespace-normal data-[state=active]:bg-background/90"
              >
                {t("analytics.tabs.tokens")}
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="rounded-xl text-center text-sm leading-5 whitespace-normal data-[state=active]:bg-background/90"
              >
                {t("analytics.tabs.tools")}
              </TabsTrigger>
              <TabsTrigger
                value="ingestion"
                className="rounded-xl text-center text-sm leading-5 whitespace-normal data-[state=active]:bg-background/90"
              >
                {t("analytics.tabs.ingestion")}
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="rounded-xl text-center text-sm leading-5 whitespace-normal data-[state=active]:bg-background/90"
              >
                {t("analytics.tabs.sessions")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" className="space-y-4">
              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.tokens.chart.title")}</CardTitle>
                  <CardDescription>{t("analytics.tokens.chart.description")}</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {tokensTimeline?.data && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={tokensTimeline.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" tickFormatter={formatDate} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {payload.map((item) => (
                                      <div key={item.dataKey} className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">{item.name}</span>
                                        <span className="font-bold text-muted-foreground">
                                          {item.value?.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
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
                          name={t("analytics.tokens.chart.series_input")}
                        />
                        <Area
                          type="monotone"
                          dataKey="tokens_out"
                          stackId="1"
                          stroke={COLORS.chart2}
                          fill={COLORS.chart2}
                          fillOpacity={0.6}
                          name={t("analytics.tokens.chart.series_output")}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.tools.success.title")}</CardTitle>
                    <CardDescription>{t("analytics.tools.success.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {toolPerformance?.data && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={toolPerformance.data.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="tool_name" className="text-xs" angle={-45} textAnchor="end" height={100} />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Bar dataKey="success_rate" fill={COLORS.chart2} name={t("analytics.tools.chart.success_rate")} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.tools.latency.title")}</CardTitle>
                    <CardDescription>{t("analytics.tools.latency.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {toolPerformance?.data && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={toolPerformance.data.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="tool_name" className="text-xs" angle={-45} textAnchor="end" height={100} />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Bar dataKey="avg_latency_ms" fill={COLORS.chart3} name={t("analytics.tools.chart.avg_latency")} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.tools.table.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">{t("analytics.tools.table.tool")}</th>
                          <th className="p-2 text-right">{t("analytics.tools.table.total_runs")}</th>
                          <th className="p-2 text-right">{t("analytics.tools.table.success_rate")}</th>
                          <th className="p-2 text-right">{t("analytics.tools.table.avg_latency")}</th>
                          <th className="p-2 text-right">{t("analytics.tools.table.min_max")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {toolPerformance?.data.map((tool: any) => (
                          <tr key={tool.tool_name} className="border-b">
                            <td className="p-2 font-medium">{tool.tool_name}</td>
                            <td className="p-2 text-right">{tool.total_runs.toLocaleString()}</td>
                            <td className="p-2 text-right">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
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
                            <td className="p-2 text-right">{tool.avg_latency_ms.toLocaleString()}ms</td>
                            <td className="p-2 text-right text-muted-foreground">
                              {tool.min_latency_ms.toLocaleString()}/{tool.max_latency_ms.toLocaleString()}ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ingestion" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.ingestion.timeline.title")}</CardTitle>
                    <CardDescription>{t("analytics.ingestion.timeline.description")}</CardDescription>
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
                          <Line type="monotone" dataKey="total_files" stroke={COLORS.chart1} name={t("analytics.ingestion.timeline.series_files")} />
                          <Line type="monotone" dataKey="total_chunks" stroke={COLORS.chart2} name={t("analytics.ingestion.timeline.series_chunks")} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.ingestion.collections.title")}</CardTitle>
                    <CardDescription>{t("analytics.ingestion.collections.description")}</CardDescription>
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
                            label={(entry) =>
                              t("analytics.ingestion.collections.label", {
                                collection: entry.collection,
                                count: entry.document_count,
                              })
                            }
                          >
                            {ingestionStats.by_collection.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl border-border/40 bg-card/30">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.ingestion.table.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">{t("analytics.ingestion.table.collection")}</th>
                          <th className="p-2 text-right">{t("analytics.ingestion.table.documents")}</th>
                          <th className="p-2 text-right">{t("analytics.ingestion.table.size")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingestionStats?.by_collection.map((collection: any) => (
                          <tr key={collection.collection} className="border-b">
                            <td className="p-2 font-medium">{collection.collection}</td>
                            <td className="p-2 text-right">{collection.document_count.toLocaleString()}</td>
                            <td className="p-2 text-right">{collection.total_mb.toLocaleString()} MB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.sessions.activity.title")}</CardTitle>
                    <CardDescription>{t("analytics.sessions.activity.description")}</CardDescription>
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
                          <Bar dataKey="session_count" fill={COLORS.chart1} name={t("analytics.sessions.activity.series_sessions")} />
                          <Bar dataKey="tools_enabled_count" fill={COLORS.chart2} name={t("analytics.sessions.activity.series_with_tools")} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/40 bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-tight">{t("analytics.sessions.model.title")}</CardTitle>
                    <CardDescription>{t("analytics.sessions.model.description")}</CardDescription>
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
                            label={(entry) =>
                              t("analytics.sessions.model.label", {
                                model: entry.model,
                                count: entry.session_count,
                              })
                            }
                          >
                            {sessionActivity.by_model.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                              />
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
    </div>
  )
}
