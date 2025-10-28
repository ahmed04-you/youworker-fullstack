import { z } from 'zod';

export interface AnalyticsOverview {
  totalSessions: number;
  totalTokens: number;
  totalToolCalls: number;
  avgSessionDuration: number;
  totalDocuments: number;
  totalChunks: number;
  successRate: number;
  lastUpdated: string;
}

export interface TokenUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

export interface ToolMetric {
  toolName: string;
  calls: number;
  successRate: number;
  avgDuration: number;
  totalTokens: number;
}

export interface SessionStat {
  sessionId: string;
  duration: number;
  tokens: number;
  toolCalls: number;
  model: string;
  createdAt: string;
}

export interface IngestionMetric {
  date: string;
  documentsAdded: number;
  chunksAdded: number;
  errors: number;
  sources: Record<string, number>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export const AnalyticsOverviewSchema = z.object({
  totalSessions: z.number(),
  totalTokens: z.number(),
  totalToolCalls: z.number(),
  avgSessionDuration: z.number(),
  totalDocuments: z.number(),
  totalChunks: z.number(),
  successRate: z.number(),
  lastUpdated: z.string().datetime(),
});

export const TokenUsageSchema = z.object({
  date: z.string().datetime(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  model: z.string(),
});

export const ToolMetricSchema = z.object({
  toolName: z.string(),
  calls: z.number(),
  successRate: z.number(),
  avgDuration: z.number(),
  totalTokens: z.number(),
});

export const SessionStatSchema = z.object({
  sessionId: z.string(),
  duration: z.number(),
  tokens: z.number(),
  toolCalls: z.number(),
  model: z.string(),
  createdAt: z.string().datetime(),
});

export const IngestionMetricSchema = z.object({
  date: z.string().datetime(),
  documentsAdded: z.number(),
  chunksAdded: z.number(),
  errors: z.number(),
  sources: z.record(z.string(), z.number()),
});