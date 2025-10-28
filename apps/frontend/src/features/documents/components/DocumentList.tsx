"use client";

import React, { memo, useCallback, useState } from 'react';
import { useDocuments, useDeleteDocumentMutation } from '../api/document-service';
import { Document, DocumentFilters } from '../types';
import { DocumentCard } from './DocumentCard';
import { DocumentFilters as FiltersComponent } from './DocumentFilters';
import { UploadDialog } from './UploadDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Trash2, FileText } from 'lucide-react';
import { useDocumentStore } from '../store/document-store';
import { toastSuccess } from '@/lib/toast-helpers';

/**
 * Props for the DocumentList component
 */
interface DocumentListProps {
  onDocumentSelect?: (doc: Document) => void;
}

/**
 * Document list component with filtering, pagination, and batch operations
 *
 * Main documents management interface displaying a grid of document cards
 * with support for filtering, pagination, multi-select, batch delete, and
 * upload. Shows loading skeletons during data fetch and helpful empty states.
 *
 * @component
 * @param {DocumentListProps} props - Component props
 * @param {function} [props.onDocumentSelect] - Optional handler when a document is selected
 *
 * @example
 * ```tsx
 * <DocumentList
 *   onDocumentSelect={(doc) => console.log('Selected:', doc)}
 * />
 * ```
 *
 * Features:
 * - Responsive grid layout (1-3 columns based on screen size)
 * - Document filtering by type, status, source, tags
 * - Pagination controls with page numbers
 * - Multi-select documents with checkbox
 * - Batch delete selected documents
 * - Upload dialog for adding new documents
 * - Loading skeleton states during data fetch
 * - Error state with retry button
 * - Empty state with helpful message and upload CTA
 * - Selection counter badge
 * - Auto-refresh after upload completes
 *
 * State Management:
 * - Page state for pagination
 * - Upload dialog open/close state
 * - Filters managed via useDocumentStore
 * - Selection state managed via useDocumentStore
 *
 * @see {@link DocumentCard} for individual document display
 * @see {@link DocumentFilters} for filtering UI
 * @see {@link UploadDialog} for document upload
 * @see {@link useDocuments} for data fetching
 * @see {@link useDocumentStore} for global document state
 */
function DocumentListComponent({ onDocumentSelect }: DocumentListProps) {
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { filters, selectedDocuments, clearSelection } = useDocumentStore();
  const deleteMutation = useDeleteDocumentMutation();
  const { data, isLoading, error, refetch } = useDocuments(page, 20, filters, { enabled: true });

  const documents = data?.documents || [];
  const totalPages = Math.ceil((data?.total || 0) / 20);

  const handleBatchDelete = useCallback(() => {
    if (selectedDocuments.length === 0) return;
    if (confirm(`Delete ${selectedDocuments.length} document(s)?`)) {
      selectedDocuments.forEach((doc) => deleteMutation.mutate(doc.id));
      clearSelection();
      toastSuccess(`${selectedDocuments.length} documents deleted`);
    }
  }, [selectedDocuments, deleteMutation, clearSelection]);

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
    refetch();
    clearSelection();
  }, [refetch, clearSelection]);

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Failed to load documents. <Button variant="link" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Documents</h2>
          {selectedDocuments.length > 0 && (
            <Badge variant="secondary">{selectedDocuments.length} selected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedDocuments.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Selected
            </Button>
          )}
          <FiltersComponent onFiltersChange={(newFilters: DocumentFilters) => {
            setPage(1);
          }} />
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full bg-muted p-6">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">No documents found</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Get started by uploading your first document. Supported formats include PDF, DOCX, TXT, and more.
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)} size="lg">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onSelect={onDocumentSelect}
                showActions={true}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && <span>...</span>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
            </div>
          )}
        </>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}

DocumentListComponent.displayName = 'DocumentList';

export const DocumentList = memo(DocumentListComponent);
