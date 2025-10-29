import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPostMultipart } from "@/lib/api-client";
import {
  toastError,
  toastLoading,
  toastLoadingError,
  toastLoadingSuccess,
  toastSuccess,
} from "@/lib/toast-helpers";
import type { Document, IngestionRun } from "../types";

type PaginatedDocuments = {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
};

type DocumentsQuerySnapshot = {
  previousQueries: Array<[QueryKey, PaginatedDocuments | undefined]>;
  toastId?: string | number;
  optimisticIds?: string[];
};

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (params: { page: number; limit: number; filters?: string }) => [...documentKeys.lists(), params] as const,
} as const;

export const ingestionKeys = {
  all: ["ingestion-runs"] as const,
  lists: () => [...ingestionKeys.all, "list"] as const,
  list: (limit = 50) => [...ingestionKeys.lists(), { limit }] as const,
} as const;

export async function fetchDocuments(page = 1, limit = 20, filters?: Record<string, any>): Promise<{ documents: Document[]; total: number; page: number; limit: number }> {
  const params = { ...filters, page, limit };
  const response = await apiGet<{ documents: Document[]; total: number; page: number; limit: number }>("/v1/documents", {
    query: params,
  });
  return response;
}

export async function deleteDocument(documentId: string): Promise<void> {
  return apiDelete(`/v1/documents/${documentId}`);
}

export async function uploadDocuments(files: File[]): Promise<Document[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  // Use apiPostMultipart to handle CSRF token and credentials properly
  const data = await apiPostMultipart<{ documents: Document[] }>("/v1/ingest/upload", formData);
  return data.documents;
}

export async function ingestFromUrl(url: string, options?: Record<string, any>): Promise<Document> {
  const response = await apiPost<{ document: Document }>("/v1/ingest", { url, ...options });
  return response.document;
}

export async function fetchIngestionRuns(limit = 50): Promise<IngestionRun[]> {
  const response = await apiGet<{ runs: IngestionRun[] }>("/v1/ingestion-runs", {
    query: { limit },
  });
  return response.runs;
}

export async function deleteIngestionRun(runId: string) {
  return apiDelete(`/v1/ingestion-runs/${runId}`);
}

export function useDocuments(page = 1, limit = 20, filters?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentKeys.list({ page, limit, filters: JSON.stringify(filters) }),
    queryFn: () => fetchDocuments(page, limit, filters),
    enabled: options?.enabled ?? true,
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string, DocumentsQuerySnapshot>({
    mutationFn: deleteDocument,
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });

      const previousQueries = queryClient.getQueriesData<PaginatedDocuments>({
        queryKey: documentKeys.lists(),
      });

      previousQueries.forEach(([key, previous]) => {
        if (previous) {
          queryClient.setQueryData<PaginatedDocuments>(key, {
            ...previous,
            documents: previous.documents.filter((document) => document.id !== documentId),
            total: Math.max(0, previous.total - 1),
          });
        }
      });

      const toastId = toastLoading("Deleting document…");

      return { previousQueries, toastId };
    },
    onError: (_error, _variables, context) => {
      context?.previousQueries?.forEach(([key, previous]) => {
        queryClient.setQueryData(key, previous);
      });
      if (context?.toastId !== undefined) {
        toastLoadingError(context.toastId, "Failed to delete document");
      } else {
        toastError("Failed to delete document");
      }
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.toastId !== undefined) {
        toastLoadingSuccess(context.toastId, "Document deleted");
      } else {
        toastSuccess("Document deleted");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useUploadDocumentsMutation(options?: { onSuccess?: () => void; onError?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<Document[], unknown, File[], DocumentsQuerySnapshot>({
    mutationFn: uploadDocuments,
    onMutate: async (files) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });

      const previousQueries = queryClient.getQueriesData<PaginatedDocuments>({
        queryKey: documentKeys.lists(),
      });

      const now = new Date();
      const optimisticDocuments = files.map((file) => ({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        tags: [],
        createdAt: now,
        updatedAt: now,
        source: "upload" as const,
        status: "pending" as const,
        chunksCount: 0,
        metadata: { optimistic: true },
      }));

      previousQueries.forEach(([key, existing]) => {
        if (existing) {
          queryClient.setQueryData<PaginatedDocuments>(key, {
            ...existing,
            documents: [...existing.documents, ...optimisticDocuments],
            total: existing.total + optimisticDocuments.length,
          });
        }
      });

      const toastId = toastLoading("Uploading documents…");

      return {
        previousQueries,
        optimisticIds: optimisticDocuments.map((doc) => doc.id),
        toastId,
      };
    },
    onError: (_error, _variables, context) => {
      context?.previousQueries?.forEach(([key, previous]) => {
        queryClient.setQueryData(key, previous);
      });
      if (context?.toastId !== undefined) {
        toastLoadingError(context.toastId, "Failed to upload documents");
      } else {
        toastError("Failed to upload documents");
      }
      options?.onError?.();
    },
    onSuccess: (data, _variables, context) => {
      const applyResult = (existing: PaginatedDocuments | undefined) => {
        if (!existing) return existing;

        const withoutOptimistic = existing.documents.filter(
          (doc) => !context?.optimisticIds?.includes(doc.id)
        );
        const newTotal = existing.total - (existing.documents.length - withoutOptimistic.length) + data.length;

        return {
          ...existing,
          documents: [...withoutOptimistic, ...data],
          total: newTotal,
        };
      };

      if (context?.previousQueries) {
        context.previousQueries.forEach(([key]) => {
          queryClient.setQueryData<PaginatedDocuments | undefined>(key, (existing) =>
            applyResult(existing)
          );
        });
      }

      const message = `${data.length} document(s) uploaded successfully`;
      if (context?.toastId !== undefined) {
        toastLoadingSuccess(context.toastId, message);
      } else {
        toastSuccess(message);
      }
      options?.onSuccess?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useIngestFromUrlMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ingestFromUrl,
    onSuccess: (data) => {
      // Update all paginated queries
      const queries = queryClient.getQueriesData<PaginatedDocuments>({
        queryKey: documentKeys.lists(),
      });

      queries.forEach(([key, existing]) => {
        if (existing) {
          queryClient.setQueryData<PaginatedDocuments>(key, {
            ...existing,
            documents: [...existing.documents, data],
            total: existing.total + 1,
          });
        }
      });

      toastSuccess("Document ingested from URL");
    },
    onError: () => {
      toastError("Failed to ingest from URL");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useIngestionRuns(limit = 50, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ingestionKeys.list(limit),
    queryFn: () => fetchIngestionRuns(limit),
    enabled: options?.enabled ?? true,
  });
}

export function useDeleteIngestionRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteIngestionRun,
    onSuccess: () => {
      toastSuccess("Ingestion run deleted");
      queryClient.invalidateQueries({ queryKey: ingestionKeys.all });
    },
    onError: () => {
      toastError("Failed to delete ingestion run");
    },
  });
}
