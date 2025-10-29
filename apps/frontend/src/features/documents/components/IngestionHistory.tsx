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
import { useAuth } from '@/lib/auth-context';

interface IngestionHistoryProps {
  limit?: number;
}

export function IngestionHistory({ limit = 10 }: IngestionHistoryProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: runs = [], isLoading, error } = useIngestionRuns(limit, {
    enabled: !authLoading && isAuthenticated
  });
  const deleteMutation = useDeleteIngestionRunMutation();

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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Errors</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{run.id.slice(-8)}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={run.status === 'failed' ? 'destructive' : run.status === 'completed' ? 'default' : 'secondary'}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {run.filesProcessed}
                </TableCell>
                <TableCell>
                  {run.chunksWritten}
                </TableCell>
                <TableCell>
                  <span className="text-xs">{format(new Date(run.startedAt), 'PPPp')}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{run.completedAt ? format(new Date(run.completedAt), 'PPPp') : 'Ongoing'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{run.errors.length} errors</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete ingestion run ${run.id}?`)) {
                        deleteMutation.mutate(run.id);
                      }
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {runs.some((run) => run.errors.length > 0) && (
        <div className="text-xs text-destructive mt-2">
          Some runs have errors. Check individual run details for more information.
        </div>
      )}
    </div>
  );
}