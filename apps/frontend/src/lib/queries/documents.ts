/**
 * React Query hooks for document-related API calls
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete } from '@/lib/api-client';
import { DocumentsResponse, DocumentRecord } from '@/lib/types';
import { toast } from 'sonner';

/**
 * Fetch all documents
 */
export function useDocumentsQuery(limit = 200) {
  return useQuery({
    queryKey: ['documents', limit],
    queryFn: async () => {
      const response = await apiGet<DocumentsResponse>('/v1/documents', {
        query: { limit },
      });
      return response.documents;
    },
  });
}

/**
 * Delete a document with optimistic updates
 */
export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: number) => apiDelete(`/v1/documents/${documentId}`),

    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] });

      const previousDocuments = queryClient.getQueryData<DocumentRecord[]>(['documents']);

      queryClient.setQueryData<DocumentRecord[]>(['documents'], (old) =>
        old?.filter((d) => d.id !== documentId) ?? []
      );

      return { previousDocuments };
    },

    onError: (err, variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(['documents'], context.previousDocuments);
      }
      toast.error('Failed to delete document');
    },

    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
