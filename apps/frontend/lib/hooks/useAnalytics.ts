/**
 * Analytics data fetching hook with SWR caching.
 */

"use client";

import useSWR from "swr";
import { useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

interface AnalyticsOptions {
  days?: number;
  interval?: "hour" | "day" | "week";
  refreshInterval?: number;
}

// Fetcher function
async function fetcher(url: string) {
  const response = await fetch(`${API_BASE}${url}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Hook for fetching overview metrics.
 */
export function useOverviewMetrics(options: AnalyticsOptions = {}) {
  const { days = 30, refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/overview?days=${days}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
}

/**
 * Hook for fetching token usage timeline.
 */
export function useTokensTimeline(options: AnalyticsOptions = {}) {
  const { days = 30, interval = "day", refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/tokens-timeline?days=${days}&interval=${interval}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook for fetching tool performance metrics.
 */
export function useToolPerformance(options: AnalyticsOptions = {}) {
  const { days = 30, refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/tool-performance?days=${days}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook for fetching tool usage timeline.
 */
export function useToolTimeline(options: AnalyticsOptions = {}) {
  const { days = 30, interval = "day", refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/tool-timeline?days=${days}&interval=${interval}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook for fetching ingestion statistics.
 */
export function useIngestionStats(options: AnalyticsOptions = {}) {
  const { days = 30, refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/ingestion-stats?days=${days}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Hook for fetching session activity.
 */
export function useSessionActivity(options: AnalyticsOptions = {}) {
  const { days = 30, refreshInterval = 60000 } = options;

  return useSWR(
    `/v1/analytics/session-activity?days=${days}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );
}

/**
 * Composite hook for all analytics data.
 */
export function useAnalytics(options: AnalyticsOptions = {}) {
  const overview = useOverviewMetrics(options);
  const tokensTimeline = useTokensTimeline(options);
  const toolPerformance = useToolPerformance(options);
  const toolTimeline = useToolTimeline(options);
  const ingestionStats = useIngestionStats(options);
  const sessionActivity = useSessionActivity(options);

  const isLoading =
    overview.isLoading ||
    tokensTimeline.isLoading ||
    toolPerformance.isLoading ||
    toolTimeline.isLoading ||
    ingestionStats.isLoading ||
    sessionActivity.isLoading;

  const error =
    overview.error ||
    tokensTimeline.error ||
    toolPerformance.error ||
    toolTimeline.error ||
    ingestionStats.error ||
    sessionActivity.error;

  const refetchAll = useCallback(() => {
    overview.mutate();
    tokensTimeline.mutate();
    toolPerformance.mutate();
    toolTimeline.mutate();
    ingestionStats.mutate();
    sessionActivity.mutate();
  }, [
    overview,
    tokensTimeline,
    toolPerformance,
    toolTimeline,
    ingestionStats,
    sessionActivity,
  ]);

  return {
    overview: overview.data,
    tokensTimeline: tokensTimeline.data,
    toolPerformance: toolPerformance.data,
    toolTimeline: toolTimeline.data,
    ingestionStats: ingestionStats.data,
    sessionActivity: sessionActivity.data,
    isLoading,
    error,
    refetchAll,
  };
}
