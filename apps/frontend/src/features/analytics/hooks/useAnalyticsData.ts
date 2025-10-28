import { useAnalyticsOverview, useTokenUsage, useToolMetrics, useSessionStats, useIngestionMetrics } from '../api/analytics-service';
import type { DateRange } from '../types';

/**
 * Aggregated hook for fetching all analytics data at once.
 * Combines overview, token usage, tool metrics, session stats, and ingestion metrics.
 *
 * @param dateRange - Optional date range filter for time-series data
 * @param dateRange.start - Start date string
 * @param dateRange.end - End date string
 *
 * @returns Object containing:
 *  - overview: Summary statistics (total sessions, tokens, etc.)
 *  - tokens: Token usage time series data
 *  - tools: Tool usage metrics
 *  - sessions: Session statistics
 *  - ingestion: Document ingestion metrics
 *  - isLoading: True if any query is loading
 *  - error: First error encountered across queries
 *  - refetch: Function to refetch all data
 *
 * @example
 * ```tsx
 * const { overview, tokens, isLoading, error, refetch } = useAnalyticsData({
 *   start: '2024-01-01',
 *   end: '2024-01-31',
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <AnalyticsCharts data={{ overview, tokens }} />;
 * ```
 */
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