/**
 * DataLoader - Generic wrapper for data loading states
 * Handles loading, error, empty, and success states
 */
"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataLoaderProps<T> {
  isLoading: boolean;
  error?: Error | null;
  data?: T | null;
  skeleton: React.ReactNode;
  empty?: React.ReactNode;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
}

/**
 * DataLoader handles all data fetching states in one component
 *
 * @param isLoading - Whether data is currently loading
 * @param error - Error object if fetch failed
 * @param data - The fetched data
 * @param skeleton - Loading skeleton to show
 * @param empty - Optional empty state component
 * @param onRetry - Optional retry callback for errors
 * @param children - Render function that receives the data
 *
 * @example
 * <DataLoader
 *   isLoading={isLoading}
 *   error={error}
 *   data={sessions}
 *   skeleton={<SessionListSkeleton />}
 *   empty={<EmptyState title="No sessions" />}
 *   onRetry={refetch}
 * >
 *   {(sessions) => sessions.map(s => <SessionCard key={s.id} {...s} />)}
 * </DataLoader>
 */
export function DataLoader<T>({
  isLoading,
  error,
  data,
  skeleton,
  empty,
  onRetry,
  children,
}: DataLoaderProps<T>) {
  // Loading state
  if (isLoading) {
    return <>{skeleton}</>;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-background/70 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Failed to load data
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="rounded-full">
            Try again
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (!data) {
    return empty ? <>{empty}</> : null;
  }

  // Success state
  return <>{children(data)}</>;
}
