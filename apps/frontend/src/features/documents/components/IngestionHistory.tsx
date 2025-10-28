import React from 'react';
import { useIngestionRuns, useDeleteIngestionRunMutation } from '../api/document-service';
import { IngestionRun } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface IngestionHistoryProps {
  limit?: number;
}

const columns = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }: { row: { original: IngestionRun } }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.id.slice(-8)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: { original: IngestionRun } }) => {
      const status = row.original.status;
      return (
        <Badge variant={status === 'failed' ? 'destructive' : status === 'completed' ? 'default' : 'secondary'}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'filesProcessed',
    header: 'Files',
    cell: ({ row }: { row: { original: IngestionRun } }) => row.original.filesProcessed,
  },
  {
    accessorKey: 'chunksWritten',
    header: 'Chunks',
    cell: ({ row }: { row: { original: IngestionRun } }) => row.original.chunksWritten,
  },
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ row }: { row: { original: IngestionRun } }) => format(new Date(row.original.startedAt), 'PPPp'),
  },
  {
    accessorKey: 'completedAt',
    header: 'Completed',
    cell: ({ row }: { row: { original: IngestionRun } }) =>
      row.original.completedAt ? format(new Date(row.original.completedAt), 'PPPp') : 'Ongoing',
  },
  {
    accessorKey: 'errors',
    header: 'Errors',
    cell: ({ row }: { row: { original: IngestionRun } }) => (
      <span className="text-xs">{row.original.errors.length} errors</span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }: { row: { original: IngestionRun } }) => {
      const deleteMutation = useDeleteIngestionRunMutation();
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Delete ingestion run ${row.original.id}?`)) {
              deleteMutation.mutate(row.original.id);
            }
          }}
          className="h-6 w-6 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      );
    },
  },
];

export function IngestionHistory({ limit = 10 }: IngestionHistoryProps) {
  const { data: runs = [], isLoading, error } = useIngestionRuns(limit);

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Failed to load ingestion history. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">No ingestion history yet.</p>
        <p className="text-sm text-muted-foreground">Upload documents to see ingestion runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ingestion History</h3>
        <Badge variant="secondary">{runs.length} runs</Badge>
      </div>
      <DataTable columns={columns} data={runs} />
      {runs.some((run) => run.errors.length > 0) && (
        <div className="text-xs text-destructive mt-2">
          Some runs have errors. Check individual run details for more information.
        </div>
      )}
    </div>
  );
}