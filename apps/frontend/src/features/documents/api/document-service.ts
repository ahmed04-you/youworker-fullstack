import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiDelete, apiGet } from "@/lib/api-client";
import type { DocumentRecord, DocumentsResponse } from "@/lib/types";

export const documentKeys = {
  all: ["documents"] as const,
  list: (limit = 200) => [...documentKeys.all, "list", limit] as const,
};

export async function fetchDocuments(limit = 200): Promise<DocumentRecord[]> {
  const response = await apiGet<DocumentsResponse>("/v1/documents", {
    query: { limit },
  });
  return response.documents;
}

export async function deleteDocument(documentId: number) {
  return apiDelete(`/v1/documents/${documentId}`);
}

export function useDocumentsQuery(limit = 200, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentKeys.list(limit),
    queryFn: () => fetchDocuments(limit),
    enabled: options?.enabled ?? true,
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.all });

      const previousDocuments = queryClient.getQueryData<DocumentRecord[]>(documentKeys.all);

      queryClient.setQueryData<DocumentRecord[]>(documentKeys.all, (old) =>
        old?.filter((document) => document.id !== documentId) ?? []
      );

      return { previousDocuments };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentKeys.all, context.previousDocuments);
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
