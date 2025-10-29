/**
 * React Query configuration and client setup
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError, ErrorType } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof ApiError && error.type === ErrorType.AUTH) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof ApiError && error.type === ErrorType.AUTH) {
          return false;
        }
        return false;
      },
    },
  },
});
