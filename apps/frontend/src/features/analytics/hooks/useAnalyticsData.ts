import { useAnalyticsOverview, useTokenUsage, useToolMetrics, useSessionStats, useIngestionMetrics } from '../api/analytics-service';
import type { DateRange } from '../types';

export function useAnalyticsData(dateRange?: DateRange) {
  const overview = useAnalyticsOverview();
  const tokens = useTokenUsage(dateRange);
  const tools = useToolMetrics(dateRange);
  const sessions = useSessionStats(dateRange);
  const ingestion = useIngestionMetrics(dateRange);

  return {
    overview: overview.data,
    tokens: tokens.data || [],
    tools: tools.data || [],
    sessions: sessions.data || [],
    ingestion: ingestion.data || [],
    isLoading: overview.isLoading || tokens.isLoading || tools.isLoading || sessions.isLoading || ingestion.isLoading,
    error: overview.error || tokens.error || tools.error || sessions.error || ingestion.error,
    refetch: () => {
      overview.refetch();
      tokens.refetch();
      tools.refetch();
      sessions.refetch();
      ingestion.refetch();
    },
  };
}