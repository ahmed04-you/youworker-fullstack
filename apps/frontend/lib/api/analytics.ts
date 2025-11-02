import { apiGet } from './client';
import type {
  OverviewMetrics,
  TokenTimelineResponse,
  ToolPerformanceResponse,
  ToolTimelineResponse,
  IngestionStatsResponse,
  SessionActivityResponse,
  ToolRunListResponse,
} from '../types';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getOverviewMetrics(days = 30): Promise<OverviewMetrics> {
  return apiGet<OverviewMetrics>(`/v1/analytics/overview${buildQuery({ days })}`);
}

export async function getTokenTimeline(options: {
  days?: number;
  interval?: 'hour' | 'day' | 'week';
} = {}): Promise<TokenTimelineResponse> {
  const { days = 30, interval = 'day' } = options;
  return apiGet<TokenTimelineResponse>(
    `/v1/analytics/tokens-timeline${buildQuery({ days, interval })}`
  );
}

export async function getToolPerformance(days = 30): Promise<ToolPerformanceResponse> {
  return apiGet<ToolPerformanceResponse>(
    `/v1/analytics/tool-performance${buildQuery({ days })}`
  );
}

export async function getToolTimeline(options: {
  days?: number;
  interval?: 'hour' | 'day' | 'week';
} = {}): Promise<ToolTimelineResponse> {
  const { days = 30, interval = 'day' } = options;
  return apiGet<ToolTimelineResponse>(
    `/v1/analytics/tool-timeline${buildQuery({ days, interval })}`
  );
}

export async function getIngestionStats(days = 30): Promise<IngestionStatsResponse> {
  return apiGet<IngestionStatsResponse>(
    `/v1/analytics/ingestion-stats${buildQuery({ days })}`
  );
}

export async function getSessionActivity(days = 30): Promise<SessionActivityResponse> {
  return apiGet<SessionActivityResponse>(
    `/v1/analytics/session-activity${buildQuery({ days })}`
  );
}

export async function listToolRuns(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<ToolRunListResponse> {
  const { limit = 100, offset = 0 } = params;
  const search = new URLSearchParams();
  if (limit !== undefined) {
    search.append('limit', String(limit));
  }
  if (offset) {
    search.append('offset', String(offset));
  }

  const query = search.toString();
  return apiGet<ToolRunListResponse>(
    `/v1/tool-runs${query ? `?${query}` : ''}`
  );
}
