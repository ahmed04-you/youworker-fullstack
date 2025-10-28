import { z } from 'zod';

export interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  source: 'upload' | 'url' | 'path';
  status: 'pending' | 'ingested' | 'error';
  chunksCount: number;
  metadata: Record<string, any>;
}

export interface DocumentFilters {
  search?: string;
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  fileType?: string;
  source?: 'upload' | 'url' | 'path';
  status?: 'pending' | 'ingested' | 'error';
}

export interface IngestionRun {
  id: string;
  documentId: string;
  status: 'pending' | 'completed' | 'failed';
  filesProcessed: number;
  chunksWritten: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: z.enum(['upload', 'url', 'path']),
  status: z.enum(['pending', 'ingested', 'error']),
  chunksCount: z.number(),
  metadata: z.record(z.string(), z.any()),
});

export const IngestionRunSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  filesProcessed: z.number(),
  chunksWritten: z.number(),
  errors: z.array(z.string()),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()),
});

export type DocumentListProps = {
  filters?: DocumentFilters;
  onDocumentSelect?: (doc: Document) => void;
};

export type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
};

export type IngestionHistoryProps = {
  limit?: number;
};