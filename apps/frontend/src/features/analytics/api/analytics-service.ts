import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api-client';
import type { 
  AnalyticsOverview, 
  TokenUsage, 
  ToolMetric, 
  SessionStat, 
  IngestionMetric,
  DateRange 
} from '../types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  tokens: (dateRange?: DateRange) => [...analyticsKeys.all, 'tokens', dateRange] as const,
  tools: (dateRange?: DateRange) => [...analyticsKeys.all, 'tools', dateRange] as const,
  sessions: (dateRange?: DateRange) => [...analyticsKeys.all, 'sessions', dateRange] as const,
  ingestion: (dateRange?: DateRange) => [...analyticsKeys.all, 'ingestion', dateRange] as const,
} as const;

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await apiGet<AnalyticsOverview>('/v1/analytics/overview');
  return response;
}

export async function fetchTokenUsage(dateRange?: DateRange): Promise<TokenUsage[]> {
  const params = dateRange ? {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString()
  } : {};
  const response = await apiGet<{interval: string, data: any[]}>('/v1/analytics/tokens-timeline', { query: params });
  // Transform snake_case API response to camelCase
  return (response.data || []).map((item: any) => ({
    date: item.period,
    inputTokens: item.tokens_in || 0,
    outputTokens: item.tokens_out || 0,
    totalTokens: item.total_tokens || 0,
    model: 'default', // API doesn't provide model per period
  }));
}

export async function fetchToolMetrics(dateRange?: DateRange): Promise<ToolMetric[]> {
  const params = dateRange ? {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString()
  } : {};
  const response = await apiGet<{data: any[]}>('/v1/analytics/tool-performance', { query: params });
  // Transform snake_case API response to camelCase
  return (response.data || []).map((item: any) => ({
    toolName: item.tool_name,
    calls: item.total_runs || 0,
    successRate: item.success_rate || 0,
    avgDuration: item.avg_latency_ms || 0,
    totalTokens: item.total_tokens || 0,
  }));
}

export async function fetchSessionStats(dateRange?: DateRange): Promise<SessionStat[]> {
  const params = dateRange ? {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString()
  } : {};
  const response = await apiGet<{timeline: any[], by_model: any[]}>('/v1/analytics/session-activity', { query: params });
  // Transform aggregated timeline data to match SessionStat interface
  // Note: API returns aggregated data, not individual sessions
  return (response.timeline || []).map((item: any) => ({
    sessionId: item.period, // Using period as ID for aggregated data
    duration: 0, // Not provided in aggregated data
    tokens: 0, // Not provided in aggregated data
    toolCalls: item.tools_enabled_count || 0,
    model: 'aggregated',
    createdAt: item.period,
  }));
}

export async function fetchIngestionMetrics(dateRange?: DateRange): Promise<IngestionMetric[]> {
  const params = dateRange ? {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString()
  } : {};
  const response = await apiGet<{timeline: any[], by_collection: any[]}>('/v1/analytics/ingestion-stats', { query: params });
  // Transform snake_case API response to camelCase
  return (response.timeline || []).map((item: any) => ({
    date: item.period,
    documentsAdded: item.total_files || 0,
    chunksAdded: item.total_chunks || 0,
    errors: item.run_count - (item.success_count || 0), // Calculate errors from failed runs
    sources: {}, // Not provided in timeline, use by_collection if needed
  }));
}

export function useAnalyticsOverview(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: fetchAnalyticsOverview,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useTokenUsage(dateRange?: DateRange, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analyticsKeys.tokens(dateRange),
    queryFn: () => fetchTokenUsage(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useToolMetrics(dateRange?: DateRange, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analyticsKeys.tools(dateRange),
    queryFn: () => fetchToolMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useSessionStats(dateRange?: DateRange, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analyticsKeys.sessions(dateRange),
    queryFn: () => fetchSessionStats(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useIngestionMetrics(dateRange?: DateRange, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analyticsKeys.ingestion(dateRange),
    queryFn: () => fetchIngestionMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

export function useAnalyticsData(dateRange?: DateRange, options?: { enabled?: boolean }) {
  const overview = useAnalyticsOverview(options);
  const tokens = useTokenUsage(dateRange, options);
  const tools = useToolMetrics(dateRange, options);
  const sessions = useSessionStats(dateRange, options);
  const ingestion = useIngestionMetrics(dateRange, options);

  return {
    overview,
    tokens,
    tools,
    sessions,
    ingestion,
    isLoading: overview.isLoading || tokens.isLoading || tools.isLoading || sessions.isLoading || ingestion.isLoading,
    error: overview.error || tokens.error || tools.error || sessions.error || ingestion.error,
  };
}

// Export for polling or refetching
export function useRefreshAnalytics() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
  };
}