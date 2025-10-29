'use client';

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRange as DayPickerDateRange } from 'react-day-picker';
import { OverviewSection } from './OverviewSection';
import { TokenUsageChart } from './TokenUsageChart';
import { ToolMetricsTable } from './ToolMetricsTable';
import { IngestionMetrics } from './IngestionMetrics';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useRefreshAnalytics } from '../api/analytics-service';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from '../types';

const PRESET_RANGES = [
  { label: 'Today', value: 'today' as const },
  { label: 'This Week', value: 'week' as const },
  { label: 'This Month', value: 'month' as const },
  { label: 'All Time', value: 'alltime' as const },
];

type PresetRange = typeof PRESET_RANGES[number]['value'];

/**
 * Main analytics dashboard component for YouWorker.AI
 *
 * Displays comprehensive analytics including token usage, tool metrics,
 * session analytics, and document ingestion statistics. Provides date range
 * filtering via preset ranges (today, week, month, 30 days) or custom dates,
 * and exports data to CSV or JSON formats.
 *
 * @component
 * @example
 * ```tsx
 * <AnalyticsDashboard />
 * ```
 *
 * Features:
 * - Date range filtering with preset shortcuts
 * - Custom date range picker
 * - Data export to CSV/JSON formats
 * - Real-time data refresh
 * - Loading skeletons during data fetch
 * - Error boundary with retry functionality
 * - Overview cards with key metrics
 * - Interactive charts for token usage and sessions
 * - Tool metrics table
 * - Document ingestion statistics
 *
 * @see {@link useAnalyticsData} for data fetching logic
 * @see {@link DateRangePicker} for custom date selection
 */
function AnalyticsDashboardComponent() {
  const [pickerDateRange, setPickerDateRange] = useState<DayPickerDateRange | undefined>(undefined);
  const [preset, setPreset] = useState<PresetRange>('week');

  // Convert DayPickerDateRange to DateRange for the hook
  const dateRange: DateRange | undefined = pickerDateRange?.from && pickerDateRange?.to
    ? { start: pickerDateRange.from, end: pickerDateRange.to }
    : undefined;

  const { overview, tokens, tools, sessions, ingestion, isLoading, error, refetch } = useAnalyticsData(dateRange);
  const refresh = useRefreshAnalytics();

  const handlePresetChange = useCallback((newPreset: PresetRange) => {
    setPreset(newPreset);
    let newRange: DayPickerDateRange | undefined;
    const now = new Date();
    const end = now;

    switch (newPreset) {
      case 'today':
        newRange = { from: new Date(now.setHours(0, 0, 0, 0)), to: end };
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        newRange = { from: weekStart, to: end };
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        newRange = { from: monthStart, to: end };
        break;
      case 'alltime':
        newRange = undefined; // No date range means all time
        break;
    }

    setPickerDateRange(newRange);
  }, []);

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <Card>
          <CardContent className="p-6 text-destructive">
            Failed to load analytics data. <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitor your AI usage, performance, and document ingestion</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1">
            {PRESET_RANGES.map((range) => (
              <Button
                key={range.value}
                variant={preset === range.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetChange(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          <OverviewSection />
          <TokenUsageChart data={tokens} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ToolMetricsTable data={tools} />
            <IngestionMetrics data={ingestion} />
          </div>
        </div>
      )}
    </div>
  );
}

AnalyticsDashboardComponent.displayName = 'AnalyticsDashboard';

export const AnalyticsDashboard = memo(AnalyticsDashboardComponent);
