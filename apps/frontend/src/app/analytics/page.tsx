'use client';

import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const AnalyticsDashboard = lazy(() => import('@/features/analytics/components/AnalyticsDashboard').then(mod => ({ default: mod.AnalyticsDashboard })));

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Analytics Dashboard</CardTitle>
          <p className="text-muted-foreground">Monitor your AI usage, performance, and document ingestion metrics</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Suspense fallback={<DashboardSkeleton />}>
            <AnalyticsDashboard />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
