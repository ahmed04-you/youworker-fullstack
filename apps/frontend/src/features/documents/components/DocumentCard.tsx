import React from 'react';
import { Document } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
import { useDocumentStore } from '../store/document-store';
import { useDeleteDocumentMutation } from '../api/document-service';
import { toast } from 'sonner';

interface DocumentCardProps {
  document: Document;
  onSelect?: (doc: Document) => void;
  showActions?: boolean;
}

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
      className={`relative rounded-lg border p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow ${
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
              toast.info('Preview not implemented yet');
            }}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Download logic
              toast.info('Download not implemented yet');
            }}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            title="Delete"
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
            className={`h-6 w-6 p-0 ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="sr-only"
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
        {document.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
        {document.tags.length > 3 && (
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