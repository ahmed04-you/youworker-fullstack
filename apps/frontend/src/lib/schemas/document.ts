import { z } from "zod";

export const documentUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one file is required"),
  tags: z.array(z.string()).optional(),
  collection: z.string().min(1).max(100).optional(),
});

export const documentIngestionSchema = z.object({
  path_or_url: z.string().min(1, "Path or URL is required"),
  from_web: z.boolean(),
  recursive: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

export const documentTextIngestionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().min(1, "Content cannot be empty").max(100000, "Content too long"),
  tags: z.array(z.string()).optional(),
  collection: z.string().min(1).max(100).optional(),
});

export const documentBulkDeleteSchema = z.object({
  document_ids: z.array(z.number().int().positive()).min(1, "Select at least one document"),
});

export const documentBulkTagSchema = z.object({
  document_ids: z.array(z.number().int().positive()).min(1, "Select at least one document"),
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  action: z.enum(["add", "remove", "replace"]),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentIngestionInput = z.infer<typeof documentIngestionSchema>;
export type DocumentTextIngestionInput = z.infer<typeof documentTextIngestionSchema>;
export type DocumentBulkDeleteInput = z.infer<typeof documentBulkDeleteSchema>;
export type DocumentBulkTagInput = z.infer<typeof documentBulkTagSchema>;
