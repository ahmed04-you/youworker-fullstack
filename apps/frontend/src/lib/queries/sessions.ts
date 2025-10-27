/**
 * React Query hooks for session-related API calls
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, apiPatch, ApiError } from '@/lib/api-client';
import { SessionSummary, SessionDetail } from '@/lib/types';
import { toast } from 'sonner';

/**
 * Fetch all sessions
 */
export function useSessionsQuery(limit = 50) {
  return useQuery({
    queryKey: ['sessions', limit],
    queryFn: async () => {
      const response = await apiGet<{ sessions: SessionSummary[] }>('/v1/sessions', {
        query: { limit },
      });
      return response.sessions;
    },
  });
}

/**
 * Fetch a single session with messages
 */
export function useSessionDetailQuery(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => apiGet<SessionDetail>(`/v1/sessions/${sessionId}`),
    enabled: !!sessionId && sessionId > 0,
  });
}

/**
 * Delete a session with optimistic updates
 */
export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => apiDelete(`/v1/sessions/${sessionId}`),

    // Optimistic update
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: ['sessions'] });

      const previousSessions = queryClient.getQueryData<SessionSummary[]>(['sessions']);

      queryClient.setQueryData<SessionSummary[]>(['sessions'], (old) =>
        old?.filter((s) => s.id !== sessionId) ?? []
      );

      return { previousSessions };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(['sessions'], context.previousSessions);
      }
      toast.error('Failed to delete session');
    },

    // Success
    onSuccess: () => {
      toast.success('Session deleted');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

/**
 * Rename a session
 */
export function useRenameSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: number; title: string }) =>
      apiPatch(`/v1/sessions/${sessionId}`, undefined, { query: { title } }),

    onSuccess: () => {
      toast.success('Session renamed');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },

    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        toast.error('Session not found');
      } else {
        toast.error('Failed to rename session');
      }
    },
  });
}
