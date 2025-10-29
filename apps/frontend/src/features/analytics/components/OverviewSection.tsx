import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TokensCard, ToolCallsCard, DocumentsCard } from './MetricCard';
import { useAnalyticsOverview } from '../api/analytics-service';
import { Skeleton } from '@/components/ui/skeleton';

export function OverviewSection() {
  const { data: overview, isLoading, error } = useAnalyticsOverview();

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-destructive">
          Failed to load analytics data. Please refresh the page.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TokensCard data={overview!} />
          <ToolCallsCard data={overview!} />
          <DocumentsCard data={overview!} />
        </div>
      </CardContent>
    </Card>
  );
}