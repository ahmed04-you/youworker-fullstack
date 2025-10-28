import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api-client";
import type { HealthStatus } from "../types";

export const healthKeys = {
  root: ["health"] as const,
};

export async function fetchHealthStatus(): Promise<HealthStatus> {
  return apiGet<HealthStatus>("/health");
}

export function useHealthQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: healthKeys.root,
    queryFn: fetchHealthStatus,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    ...options,
  });
}
