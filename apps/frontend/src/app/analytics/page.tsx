"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  BarChart2,
  BarChart3,
  Clock,
  GaugeCircle,
  LineChart as LineChartGlyph,
  PieChart as PieChartGlyph,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api-client";
import {
  IngestionStatsResponse,
  OverviewMetrics,
  SessionActivityResponse,
  ToolPerformanceResponse,
  ToolTimelineResponse,
  TokensTimelineResponse,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  jade: "hsl(142 76% 36%)",
  amber: "hsl(45 92% 58%)",
  lilac: "hsl(263 75% 60%)",
  destructive: "hsl(var(--destructive))",
};

const PERIOD_OPTIONS = [7, 30, 90];
const INTERVAL_OPTIONS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
];

interface AggregatedToolTimeline {
  period: string;
  total_runs: number;
  success_rate: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [period, setPeriod] = useState<number>(30);
  const [interval, setInterval] = useState<"day" | "week">("day");
  const [activeTab, setActiveTab] = useState("usage");
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [tokensTimeline, setTokensTimeline] = useState<TokensTimelineResponse | null>(null);
  const [toolPerformance, setToolPerformance] = useState<ToolPerformanceResponse | null>(null);
  const [toolTimeline, setToolTimeline] = useState<ToolTimelineResponse | null>(null);
  const [sessionActivity, setSessionActivity] = useState<SessionActivityResponse | null>(null);
  const [ingestionStats, setIngestionStats] = useState<IngestionStatsResponse | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/settings");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void fetchAnalytics();
    }
  }, [authLoading, isAuthenticated, period, interval]);

  const aggregatedToolTimeline: AggregatedToolTimeline[] = useMemo(() => {
    if (!toolTimeline?.data) return [];
    const map = new Map<string, AggregatedToolTimeline>();
    for (const entry of toolTimeline.data) {
      const current = map.get(entry.period) || {
        period: entry.period,
        total_runs: 0,
        success_rate: 0,
      };
      current.total_runs += entry.run_count;
      current.success_rate += entry.success_rate * entry.run_count;
      map.set(entry.period, current);
    }
    return Array.from(map.values()).map((item) => ({
      period: item.period,
      total_runs: item.total_runs,
      success_rate: item.total_runs
        ? Number((item.success_rate / item.total_runs).toFixed(1))
        : 0,
    }));
  }, [toolTimeline]);

  const ingestionTimeline = useMemo(() => ingestionStats?.timeline ?? [], [ingestionStats]);

  const tokensSeries = useMemo(
    () =>
      tokensTimeline?.data.map((point) => ({
        period: point.period,
        tokens: point.total_tokens,
        messages: point.message_count,
      })) ?? [],
    [tokensTimeline]
  );

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [
        nextOverview,
        nextTokens,
        nextToolPerformance,
        nextToolTimeline,
        nextSessionActivity,
        nextIngestionStats,
      ] = await Promise.all([
        apiGet<OverviewMetrics>("/v1/analytics/overview", { query: { days: period } }),
        apiGet<TokensTimelineResponse>("/v1/analytics/tokens-timeline", {
          query: { days: period, interval },
        }),
        apiGet<ToolPerformanceResponse>("/v1/analytics/tool-performance", {
          query: { days: period },
        }),
        apiGet<ToolTimelineResponse>("/v1/analytics/tool-timeline", {
          query: { days: period, interval },
        }),
        apiGet<SessionActivityResponse>("/v1/analytics/session-activity", {
          query: { days: period },
        }),
        apiGet<IngestionStatsResponse>("/v1/analytics/ingestion-stats", {
          query: { days: period },
        }),
      ]);

      setOverview(nextOverview);
      setTokensTimeline(nextTokens);
      setToolPerformance(nextToolPerformance);
      setToolTimeline(nextToolTimeline);
      setSessionActivity(nextSessionActivity);
      setIngestionStats(nextIngestionStats);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load analytics insight.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="h-12 w-48 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card/70 p-4 md:p-6 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Intelligence pulse
          </p>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            Observe how YouWorker thinks, acts, and learns
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            These dashboards blend crimson velocity with cream clarity. Tune the time horizon and
            instantly inspect usage dynamics, tool reliability, and knowledge ingestion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <select
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value))}
            className="h-9 w-[120px] rounded-full border border-border/70 bg-background/80 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Select period"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
          <select
            value={interval}
            onChange={(event) => setInterval(event.target.value as "day" | "week")}
            className="h-9 w-[140px] rounded-full border border-border/70 bg-background/80 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Select interval"
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground focus:ring-2 focus:ring-primary/30"
            onClick={() => fetchAnalytics()}
            disabled={loading}
            aria-label="Refresh analytics data"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh view
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Sessions"
          icon={<BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />}
          primary={overview?.sessions.total ?? 0}
          helper={`${overview?.sessions.avg_per_day ?? 0} daily`}
          loading={loading}
        />
        <SummaryCard
          title="Messages"
          icon={<Activity className="h-4 w-4 text-primary" aria-hidden="true" />}
          primary={overview?.messages.total ?? 0}
          helper={`${overview?.messages.avg_per_session ?? 0} per session`}
          loading={loading}
        />
        <SummaryCard
          title="Tokens"
          icon={<GaugeCircle className="h-4 w-4 text-primary" aria-hidden="true" />}
          primary={overview?.tokens.total ?? 0}
          helper={`${overview?.tokens.avg_per_message ?? 0} / message`}
          loading={loading}
        />
        <SummaryCard
          title="Tools"
          icon={<Target className="h-4 w-4 text-primary" aria-hidden="true" />}
          primary={overview?.tools.total_runs ?? 0}
          helper={`${overview?.tools.success_rate ?? 0}% success`}
          loading={loading}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6 rounded-3xl border border-border bg-card/70 p-4 md:p-6 shadow-xl backdrop-blur"
        aria-label="Analytics tabs"
      >
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 rounded-2xl bg-background/80 p-1">
          <TabsTrigger value="usage" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Usage pulse
          </TabsTrigger>
          <TabsTrigger value="tooling" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Tool intelligence
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Knowledge ingestion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-5" aria-label="Usage analytics">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <LineChartGlyph className="h-4 w-4 text-primary" aria-hidden="true" />
                  Token flow
                </CardTitle>
                <CardDescription>Tokens and message throughput across the selected period.</CardDescription>
              </div>
              <Badge className="rounded-full bg-primary/10 text-primary" aria-label={`Interval: ${interval}`}>
                {interval.charAt(0).toUpperCase() + interval.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading chart" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tokensSeries} aria-label="Token flow chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="tokens" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} name="Tokens" />
                    <Line type="monotone" dataKey="messages" stroke={CHART_COLORS.jade} strokeWidth={2} dot={false} name="Messages" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Session cadence
                </CardTitle>
                <CardDescription>Conversation creation and tool-enabled adoption.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading chart" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sessionActivity?.timeline ?? []} aria-label="Session cadence chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="session_count"
                      stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary}
                      fillOpacity={0.2}
                      name="Sessions"
                    />
                    <Area
                      type="monotone"
                      dataKey="tools_enabled_rate"
                      name="Tools enabled (%)"
                      stroke={CHART_COLORS.lilac}
                      fill={CHART_COLORS.lilac}
                      fillOpacity={0.15}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  Language model mix
                </CardTitle>
                <CardDescription>Sessions grouped by the requested model identifier.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <div className="flex h-10 items-center justify-between">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex h-10 items-center justify-between">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="flex h-10 items-center justify-between">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table" aria-label="Language model usage table">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-3 pr-4 font-medium" scope="col">Model</th>
                        <th className="py-3 font-medium" scope="col">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionActivity?.by_model.length ? (
                        sessionActivity.by_model.map((entry) => (
                          <tr key={entry.model || "default"} className="border-t border-border/50">
                            <td className="py-3 pr-4 font-medium text-foreground">
                              {entry.model || "default"}
                            </td>
                            <td className="py-3 text-muted-foreground">{entry.session_count.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-muted-foreground">
                            No model usage recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tooling" className="space-y-5" aria-label="Tooling analytics">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PieChartGlyph className="h-4 w-4 text-primary" aria-hidden="true" />
                  Tool performance
                </CardTitle>
                <CardDescription>Success rate and latency by MCP-qualified tool name.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading chart" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={toolPerformance?.data ?? []} aria-label="Tool performance chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="tool_name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="total_runs" name="Runs" fill={CHART_COLORS.primary} barSize={24} />
                    <Bar dataKey="success_rate" name="Success %" fill={CHART_COLORS.jade} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <LineChartGlyph className="h-4 w-4 text-primary" aria-hidden="true" />
                  Tool activation cadence
                </CardTitle>
                <CardDescription>Aggregate run volume and success across the chosen interval.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading chart" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aggregatedToolTimeline} aria-label="Tool activation cadence chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="total_runs"
                      stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary}
                      fillOpacity={0.2}
                      name="Runs"
                    />
                    <Area
                      type="monotone"
                      dataKey="success_rate"
                      stroke={CHART_COLORS.jade}
                      fill={CHART_COLORS.jade}
                      fillOpacity={0.2}
                      name="Success %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-5" aria-label="Knowledge analytics">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Ingestion momentum
                </CardTitle>
                <CardDescription>Track ingestion runs, chunks created, and success rate.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[300px] md:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading chart" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ingestionTimeline} aria-label="Ingestion momentum chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                      type="monotone"
                      dataKey="run_count"
                      stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary}
                      fillOpacity={0.2}
                      name="Runs"
                    />
                    <Area
                      type="monotone"
                      dataKey="total_chunks"
                      stroke={CHART_COLORS.lilac}
                      fill={CHART_COLORS.lilac}
                      fillOpacity={0.15}
                      name="Chunks"
                    />
                    <Line
                      type="monotone"
                      dataKey="success_rate"
                      stroke={CHART_COLORS.jade}
                      strokeWidth={2}
                      name="Success %"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PieChartGlyph className="h-4 w-4 text-primary" aria-hidden="true" />
                  Collection footprint
                </CardTitle>
                <CardDescription>Documents stored per collection, sorted by volume.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-4">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ingestionStats?.by_collection.length ? (
                    ingestionStats.by_collection.map((collection) => (
                      <div
                        key={collection.collection}
                        className="group rounded-2xl border border-border/60 bg-background/80 p-4 text-sm hover:bg-background focus-within:ring-2 focus-within:ring-primary/30 transition-colors"
                        tabIndex={0}
                        role="button"
                        aria-label={`Collection ${collection.collection}: ${collection.document_count} documents, ${collection.total_mb} MB`}
                      >
                        <p className="font-semibold text-foreground group-hover:text-primary">{collection.collection}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {collection.document_count.toLocaleString()} documents • {collection.total_mb} MB
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                      No ingestion activity yet. Start by uploading knowledge assets.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  icon: ReactNode;
  primary: number;
  helper: string;
  loading?: boolean;
}

function SummaryCard({ title, icon, primary, helper, loading = false }: SummaryCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group rounded-2xl border border-border/70 bg-background/70 shadow-sm hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/30">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-xl md:text-2xl font-semibold text-foreground">{primary.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary transition-colors duration-200 group-hover:bg-primary/20">{icon}</div>
      </CardContent>
    </Card>
  );
}
