import { z } from "zod";

/**
 * Schema for document tag operations
 */
export const documentTagSchema = z.object({
  documentIds: z.array(z.number()).min(1, "At least one document is required"),
  tags: z
    .array(z.string().trim().min(1, "Tag cannot be empty"))
    .min(1, "At least one tag is required"),
});

export type DocumentTagData = z.infer<typeof documentTagSchema>;

/**
 * Schema for bulk delete operations
 */
export const bulkDeleteSchema = z.object({
  documentIds: z.array(z.number()).min(1, "At least one document is required"),
});

export type BulkDeleteData = z.infer<typeof bulkDeleteSchema>;

/**
 * Schema for document search/filter
 */
export const documentSearchSchema = z.object({
  searchTerm: z.string().optional(),
  collection: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(500).default(200),
});

export type DocumentSearchData = z.infer<typeof documentSearchSchema>;
