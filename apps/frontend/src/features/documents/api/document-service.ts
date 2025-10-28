import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { Document, IngestionRun } from "../types";

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

export async function deleteDocument(documentId: string) {
  return apiDelete(`/v1/documents/${documentId}`);
}

export async function uploadDocuments(files: File[]): Promise<Document[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  // Use fetch directly for multipart upload to avoid Content-Type override
  const response = await fetch("/v1/ingest/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
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

  return useMutation({
    mutationFn: deleteDocument,
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.all });

      const previousDocuments = queryClient.getQueryData<Document[]>(documentKeys.lists());

      queryClient.setQueryData<Document[]>(documentKeys.lists(), (old) =>
        old?.filter((document) => document.id !== documentId) ?? []
      );

      return { previousDocuments };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentKeys.lists(), context.previousDocuments);
      }
      toast.error("Failed to delete document");
    },
    onSuccess: () => {
      toast.success("Document deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useUploadDocumentsMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocuments,
    onSuccess: (data, variables, context) => {
      // Optimistically add new documents
      queryClient.setQueryData(documentKeys.lists(), (old: Document[] | undefined) => [
        ...(old || []),
        ...data,
      ]);
      toast.success(`${data.length} document(s) uploaded successfully`);
      options?.onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to upload documents");
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
      queryClient.setQueryData(documentKeys.lists(), (old: Document[] | undefined) => [
        ...(old || []),
        data,
      ]);
      toast.success("Document ingested from URL");
    },
    onError: () => {
      toast.error("Failed to ingest from URL");
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
      toast.success("Ingestion run deleted");
      queryClient.invalidateQueries({ queryKey: ingestionKeys.all });
    },
    onError: () => {
      toast.error("Failed to delete ingestion run");
    },
  });
}
