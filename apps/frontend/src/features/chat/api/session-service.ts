import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiDelete, apiGet, apiPatch, ApiError } from "@/lib/api-client";
import type { SessionDetail, SessionSummary } from "@/lib/types";

export const sessionKeys = {
  all: ["sessions"] as const,
  list: (limit = 50) => [...sessionKeys.all, "list", limit] as const,
  detail: (sessionId: number) => [...sessionKeys.all, "detail", sessionId] as const,
};

export async function fetchSessions(limit = 50): Promise<SessionSummary[]> {
  const response = await apiGet<{ sessions: SessionSummary[] }>("/v1/sessions", {
    query: { limit },
  });
  return response.sessions;
}

export async function fetchSessionDetail(sessionId: number): Promise<SessionDetail> {
  return apiGet<SessionDetail>(`/v1/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: number) {
  return apiDelete(`/v1/sessions/${sessionId}`);
}

export async function renameSession(sessionId: number, title: string) {
  return apiPatch(`/v1/sessions/${sessionId}`, undefined, { query: { title } });
}

export function useSessionsQuery(limit = 50, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sessionKeys.list(limit),
    queryFn: () => fetchSessions(limit),
    enabled: options?.enabled ?? true,
  });
}

export function useSessionDetailQuery(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId ?? 0),
    queryFn: () => fetchSessionDetail(sessionId as number),
    enabled: !!sessionId && sessionId > 0,
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSession,
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: sessionKeys.all });

      const previousSessions = queryClient.getQueryData<SessionSummary[]>(sessionKeys.all);

      queryClient.setQueryData<SessionSummary[]>(sessionKeys.all, (old) =>
        old?.filter((session) => session.id !== sessionId) ?? []
      );

      return { previousSessions };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(sessionKeys.all, context.previousSessions);
      }
      toast.error("Failed to delete session");
    },
    onSuccess: () => {
      toast.success("Session deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}

export function useRenameSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: number; title: string }) =>
      renameSession(sessionId, title),
    onSuccess: () => {
      toast.success("Session renamed");
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        toast.error("Session not found");
      } else {
        toast.error("Failed to rename session");
      }
    },
  });
}
