'use client';

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { DateRange as DayPickerDateRange } from 'react-day-picker';
import { DateRangePicker } from './DateRangePicker';
import { OverviewSection } from './OverviewSection';
import { TokenUsageChart } from './TokenUsageChart';
import { ToolMetricsTable } from './ToolMetricsTable';
import { SessionAnalytics } from './SessionAnalytics';
import { IngestionMetrics } from './IngestionMetrics';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useRefreshAnalytics } from '../api/analytics-service';
import { Skeleton } from '@/components/ui/skeleton';
import { exportToCSV, exportToJSON } from '@/lib/export';
import { toastError, toastSuccess } from '@/lib/toast-helpers';
import { DateRange } from '../types';

const PRESET_RANGES = [
  { label: 'Today', value: 'today' as const },
  { label: 'This Week', value: 'week' as const },
  { label: 'This Month', value: 'month' as const },
  { label: 'Last 30 Days', value: '30days' as const },
  { label: 'Custom', value: 'custom' as const },
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
      case '30days':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        newRange = { from: thirtyDaysAgo, to: end };
        break;
      case 'custom':
        newRange = undefined;
        break;
    }

    setPickerDateRange(newRange);
  }, []);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    if (!overview) {
      toastError("No data to export");
      return;
    }

    const exportData = {
      overview,
      tokens,
      tools,
      sessions: sessions.slice(0, 10), // Limit for export
      ingestion,
      dateRange: dateRange ? {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      } : null,
      exportedAt: new Date().toISOString(),
    };

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    if (format === 'csv') {
      exportToCSV(exportData, `youworker-analytics-${formatDate(new Date())}`);
    } else {
      exportToJSON(exportData, `youworker-analytics-${formatDate(new Date())}`);
    }

    toastSuccess(`Analytics exported as ${format.toUpperCase()}`);
  }, [overview, tokens, tools, sessions, ingestion, dateRange]);

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
          <DateRangePicker
            value={pickerDateRange}
            onChange={setPickerDateRange}
            placeholder="Custom date range"
          />
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <TokenUsageChart data={tokens} />
            <SessionAnalytics data={sessions} />
          </div>
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
