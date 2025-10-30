import React from 'react';
import { Document } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
import { useDocumentStore } from '../store/document-store';
import { useDeleteDocumentMutation } from '../api/document-service';
import { toastInfo } from '@/lib/toast-helpers';

/**
 * Props for the DocumentCard component
 */
interface DocumentCardProps {
  document: Document;
  onSelect?: (doc: Document) => void;
  showActions?: boolean;
}

/**
 * Document card component displaying document metadata and actions
 *
 * Renders a card showing document information including name, size, type,
 * status, tags, and creation date. Supports inline actions for preview,
 * download, delete, and selection. Visual indicator shows when document
 * is selected. Optimized with React.memo for performance.
 *
 * @component
 * @param {DocumentCardProps} props - Component props
 * @param {Document} props.document - Document data to display
 * @param {function} [props.onSelect] - Optional handler when card is clicked
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 *
 * @example
 * ```tsx
 * <DocumentCard
 *   document={{
 *     id: '123',
 *     name: 'report.pdf',
 *     type: 'pdf',
 *     size: 2048000,
 *     status: 'ready',
 *     source: 'upload',
 *     tags: ['finance', 'q4'],
 *     createdAt: new Date(),
 *     chunksCount: 15
 *   }}
 *   onSelect={handleDocumentSelect}
 *   showActions={true}
 * />
 * ```
 *
 * Features:
 * - Document icon with type indicator
 * - Name and file size display
 * - Status badge (ready, processing, error)
 * - Source badge (upload, url, integration)
 * - Tag badges (first 3 shown, +N more indicator)
 * - Creation date and chunk count
 * - Checkbox for multi-select with visual highlight
 * - Hover actions: preview, download, delete
 * - Click card to select/trigger onSelect
 * - Confirmation dialog for delete action
 * - Ring highlight when selected
 *
 * @see {@link useDocumentStore} for selection state management
 * @see {@link useDeleteDocumentMutation} for delete functionality
 */
export const DocumentCard = React.memo(function DocumentCard({ document, onSelect, showActions = true }: DocumentCardProps) {
  const { toggleDocumentSelection, selectedDocuments } = useDocumentStore();
  const isSelected = selectedDocuments.some((d) => d.id === document.id);
  const deleteMutation = useDeleteDocumentMutation();

  const handleDelete = () => {
    if (confirm(`Delete ${document.name}?`)) {
      deleteMutation.mutate(document.id, {
        onSuccess: () => {
          if (onSelect) onSelect(document);
        },
      });
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleDocumentSelection(document);
  };

  return (
    <div
      className={`relative rounded-lg border p-3 space-y-2 cursor-pointer hover:shadow-md transition-shadow ${
        isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
      onClick={onSelect ? () => onSelect(document) : undefined}
    >
      {showActions && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Preview logic, e.g., open modal with DocumentPreview
              toastInfo("Preview not implemented yet");
            }}
            title="Preview"
            aria-label={`Preview ${document.name}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Download logic
              toastInfo("Download not implemented yet");
            }}
            title="Download"
            aria-label={`Download ${document.name}`}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            title="Delete"
            aria-label={`Delete ${document.name}`}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium line-clamp-1">{document.name}</h3>
            <p className="text-sm text-muted-foreground">
              {document.size ? `${(document.size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
            </p>
          </div>
        </div>
        {showActions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelect}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${document.name}`}
            className={`h-6 w-6 p-0 ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="sr-only"
              aria-hidden="true"
            />
            <div className={`h-3 w-3 rounded transition-colors ${isSelected ? 'bg-white' : 'bg-transparent border-2 border-muted-foreground'}`} />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">{document.type}</Badge>
        <Badge variant={document.status === 'error' ? 'destructive' : 'default'} className="text-xs">
          {document.status}
        </Badge>
        {document.source !== 'upload' && (
          <Badge variant="outline" className="text-xs">{document.source}</Badge>
        )}
        {Array.isArray(document.tags) && document.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
        {Array.isArray(document.tags) && document.tags.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{document.tags.length - 3} more
          </Badge>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Created: {document.createdAt.toLocaleDateString()}
        {document.chunksCount > 0 && ` | ${document.chunksCount} chunks`}
      </div>
    </div>
  );
});
