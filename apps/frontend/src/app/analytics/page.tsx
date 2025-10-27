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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const CHART_COLORS = {
  crimson: "#9b1d2d",
  cream: "#f3cbb5",
  jade: "#10b981",
  amber: "#f59e0b",
  lilac: "#8b5cf6",
};

const PERIOD_OPTIONS = [7, 30, 90];
const INTERVAL_OPTIONS = [
  { value: "day", label: "Daily cadence" },
  { value: "week", label: "Weekly cadence" },
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
      <div className="flex h-full items-center justify-center">
        <div className="rounded-3xl border border-border px-6 py-8 text-sm text-muted-foreground shadow-sm">
          Authenticating…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Intelligence pulse
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Observe how YouWorker thinks, acts, and learns
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            These dashboards blend crimson velocity with cream clarity. Tune the time horizon and
            instantly inspect usage dynamics, tool reliability, and knowledge ingestion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(event) => setPeriod(Number(event.target.value))}
            className="h-9 rounded-full border border-border/70 bg-background/80 px-4 text-xs font-semibold text-foreground focus:outline-none"
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
            className="h-9 rounded-full border border-border/70 bg-background/80 px-4 text-xs font-semibold text-foreground focus:outline-none"
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => fetchAnalytics()}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Sessions"
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
          primary={overview?.sessions.total ?? 0}
          helper={`${overview?.sessions.avg_per_day ?? 0} daily`}
        />
        <SummaryCard
          title="Messages"
          icon={<Activity className="h-4 w-4 text-primary" />}
          primary={overview?.messages.total ?? 0}
          helper={`${overview?.messages.avg_per_session ?? 0} per session`}
        />
        <SummaryCard
          title="Tokens"
          icon={<GaugeCircle className="h-4 w-4 text-primary" />}
          primary={overview?.tokens.total ?? 0}
          helper={`${overview?.tokens.avg_per_message ?? 0} / message`}
        />
        <SummaryCard
          title="Tools"
          icon={<Target className="h-4 w-4 text-primary" />}
          primary={overview?.tools.total_runs ?? 0}
          helper={`${overview?.tools.success_rate ?? 0}% success`}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6 rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-background/80 p-1">
          <TabsTrigger value="usage" className="rounded-xl">
            Usage pulse
          </TabsTrigger>
          <TabsTrigger value="tooling" className="rounded-xl">
            Tool intelligence
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-xl">
            Knowledge ingestion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-5">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <LineChartGlyph className="h-4 w-4 text-primary" />
                  Token flow
                </CardTitle>
                <CardDescription>Tokens and message throughput across the selected period.</CardDescription>
              </div>
              <Badge className="rounded-full bg-primary/10 text-primary">
                Interval: {interval}
              </Badge>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tokensSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ded1" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="tokens" stroke={CHART_COLORS.crimson} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="messages" stroke={CHART_COLORS.jade} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Session cadence
                </CardTitle>
                <CardDescription>Conversation creation and tool-enabled adoption.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionActivity?.timeline ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ded1" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="session_count"
                    stroke={CHART_COLORS.crimson}
                    fill={CHART_COLORS.crimson}
                    fillOpacity={0.2}
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
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Language model mix
                </CardTitle>
                <CardDescription>Sessions grouped by the requested model identifier.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Model</th>
                    <th className="py-2">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionActivity?.by_model.map((entry) => (
                    <tr key={entry.model || "default"} className="border-t border-border/50">
                      <td className="py-2">
                        <span className="font-medium text-foreground">
                          {entry.model || "default"}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{entry.session_count}</td>
                    </tr>
                  )) ?? (
                    <tr>
                      <td colSpan={2} className="py-3 text-center text-muted-foreground">
                        No model usage recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tooling" className="space-y-5">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PieChartGlyph className="h-4 w-4 text-primary" />
                  Tool performance
                </CardTitle>
                <CardDescription>Success rate and latency by MCP-qualified tool name.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={toolPerformance?.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ded1" />
                  <XAxis dataKey="tool_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_runs" name="Runs" fill={CHART_COLORS.crimson} />
                  <Bar dataKey="success_rate" name="Success %" fill={CHART_COLORS.jade} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <LineChartGlyph className="h-4 w-4 text-primary" />
                  Tool activation cadence
                </CardTitle>
                <CardDescription>Aggregate run volume and success across the chosen interval.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aggregatedToolTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ded1" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total_runs"
                    stroke={CHART_COLORS.crimson}
                    fill={CHART_COLORS.crimson}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-5">
          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Ingestion momentum
                </CardTitle>
                <CardDescription>Track ingestion runs, chunks created, and success rate.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ingestionTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1ded1" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="run_count"
                    stroke={CHART_COLORS.crimson}
                    fill={CHART_COLORS.crimson}
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
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-background/70 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PieChartGlyph className="h-4 w-4 text-primary" />
                  Collection footprint
                </CardTitle>
                <CardDescription>Documents stored per collection, sorted by volume.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {ingestionStats?.by_collection.map((collection) => (
                <div
                  key={collection.collection}
                  className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm"
                >
                  <p className="font-semibold text-foreground">{collection.collection}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {collection.document_count} documents • {collection.total_mb} MB
                  </p>
                </div>
              )) ?? (
                <p className="text-sm text-muted-foreground">
                  No ingestion activity yet. Start by uploading knowledge assets.
                </p>
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
}

function SummaryCard({ title, icon, primary, helper }: SummaryCardProps) {
  return (
    <Card className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{primary.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}
