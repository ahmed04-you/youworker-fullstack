"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Activity, FileText, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OverviewStats {
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  total_tool_calls: number;
  active_users: number;
}

interface TokenData {
  by_model: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }>;
  by_day: Array<{ date: string; tokens: number }>;
}

interface ToolData {
  tools: Array<{
    name: string;
    calls: number;
    success_rate: number;
    avg_latency_ms: number;
  }>;
}

interface SessionData {
  total_sessions: number;
  avg_messages_per_session: number;
  avg_duration_minutes: number;
  by_date: Array<{ date: string; sessions: number; messages: number }>;
}

interface IngestionData {
  total_documents: number;
  total_chunks: number;
  by_type: Record<string, number>;
  by_collection: Record<string, number>;
}

export default function AnalyticsPage() {
  const { apiKey, isAuthenticated } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [tools, setTools] = useState<ToolData | null>(null);
  const [sessions, setSessions] = useState<SessionData | null>(null);
  const [ingestion, setIngestion] = useState<IngestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/settings");
      return;
    }
    fetchAllData();
  }, [isAuthenticated, router]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [overviewRes, tokensRes, toolsRes, sessionsRes, ingestionRes] = await Promise.all([
        fetch("http://localhost:8001/v1/analytics/overview", { headers: { "X-API-Key": apiKey || "" } }),
        fetch("http://localhost:8001/v1/analytics/tokens", { headers: { "X-API-Key": apiKey || "" } }),
        fetch("http://localhost:8001/v1/analytics/tools", { headers: { "X-API-Key": apiKey || "" } }),
        fetch("http://localhost:8001/v1/analytics/sessions", { headers: { "X-API-Key": apiKey || "" } }),
        fetch("http://localhost:8001/v1/analytics/ingestion", { headers: { "X-API-Key": apiKey || "" } }),
      ]);

      if (!overviewRes.ok || !tokensRes.ok || !toolsRes.ok || !sessionsRes.ok || !ingestionRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      setOverview(await overviewRes.json());
      setTokens(await tokensRes.json());
      setTools(await toolsRes.json());
      setSessions(await sessionsRes.json());
      setIngestion(await ingestionRes.json());
    } catch (error) {
      toast.error("Failed to load analytics: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="h-6 w-6 animate-spin" />
              <span>Loading analytics...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
          <CardDescription>Overview of usage statistics, token consumption, tool usage, sessions, and document ingestion.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {overview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overview.total_sessions.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overview.total_messages.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overview.total_tokens.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Tool Calls</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overview.total_tool_calls.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{overview.active_users}</div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-muted-foreground">No overview data available.</p>
              )}
            </TabsContent>

            {/* Tokens Tab */}
            <TabsContent value="tokens" className="space-y-6">
              {tokens ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Token Usage by Model</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={Object.entries(tokens.by_model).map(([model, data]) => ({ model, ...data }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="model" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="total_tokens" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Tokens Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={tokens.by_day}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="tokens" stroke="#3B82F6" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-muted-foreground">No token data available.</p>
              )}
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="space-y-6">
              {tools ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Tool Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={tools.tools.map((tool) => ({ name: tool.name, value: tool.calls }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}
                        >
                          {tools.tools.map((tool, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {tools.tools.map((tool) => (
                        <Card key={tool.name}>
                          <CardContent className="p-4">
                            <div className="text-sm font-medium">{tool.name}</div>
                            <div className="text-2xl font-bold">{tool.calls}</div>
                            <Badge variant={tool.success_rate > 0.9 ? "default" : "secondary"}>
                              { (tool.success_rate * 100).toFixed(1) }% Success
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              Avg: {tool.avg_latency_ms}ms
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-muted-foreground">No tool data available.</p>
              )}
            </TabsContent>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-6">
              {sessions ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Session Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold">{sessions.total_sessions}</div>
                            <p className="text-sm text-muted-foreground">Total Sessions</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold">{sessions.avg_messages_per_session.toFixed(1)}</div>
                            <p className="text-sm text-muted-foreground">Avg Messages/Session</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold">{sessions.avg_duration_minutes.toFixed(1)} min</div>
                            <p className="text-sm text-muted-foreground">Avg Duration</p>
                          </CardContent>
                        </Card>
                      </div>
                      <Card>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={sessions.by_date}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Area type="monotone" dataKey="sessions" stroke="#3B82F6" fill="#3B82F6" />
                              <Area type="monotone" dataKey="messages" stroke="#10B981" fill="#10B981" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-muted-foreground">No session data available.</p>
              )}
            </TabsContent>

            {/* Ingestion Tab */}
            <TabsContent value="ingestion" className="space-y-6">
              {ingestion ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Ingestion Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold">{ingestion.total_documents}</div>
                            <p className="text-sm text-muted-foreground">Total Documents</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-2xl font-bold">{ingestion.total_chunks.toLocaleString()}</div>
                            <p className="text-sm text-muted-foreground">Total Chunks</p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>By Type</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <PieChart>
                                <Pie
                                  data={Object.entries(ingestion.by_type).map(([type, count]) => ({ name: type, value: count }))}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}
                                >
                                  {Object.entries(ingestion.by_type).map(([type, count], index) => (
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
                            <CardTitle>By Collection</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {Object.entries(ingestion.by_collection).map(([collection, count]) => (
                                <li key={collection} className="flex justify-between">
                                  <span>{collection}</span>
                                  <Badge>{count}</Badge>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-muted-foreground">No ingestion data available.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}