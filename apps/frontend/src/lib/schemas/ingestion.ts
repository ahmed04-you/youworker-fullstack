import { z } from "zod";

/**
 * Allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "audio/mpeg",
  "audio/wav",
  "application/json",
  "text/csv",
] as const;

/**
 * Maximum file size in bytes (100 MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Schema for URL ingestion validation
 */
export const urlIngestionSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  tags: z.array(z.string()).optional(),
  collection: z.string().min(1, "Collection name is required").optional(),
});

export type UrlIngestionData = z.infer<typeof urlIngestionSchema>;

/**
 * Schema for path ingestion validation
 */
export const pathIngestionSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .refine((path) => !path.includes(".."), "Path traversal is not allowed"),
  tags: z.array(z.string()).optional(),
  collection: z.string().optional(),
  recursive: z.boolean().default(true),
});

export type PathIngestionData = z.infer<typeof pathIngestionSchema>;

/**
 * Schema for text/note ingestion
 */
export const textIngestionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  tags: z.array(z.string()).optional(),
  collection: z.string().optional(),
});

export type TextIngestionData = z.infer<typeof textIngestionSchema>;

/**
 * File validation schema
 */
export const fileSchema = z
  .custom<File>()
  .refine((file) => file.size <= MAX_FILE_SIZE, {
    message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
  })
  .refine((file) => ALLOWED_FILE_TYPES.includes(file.type as any), {
    message: "File type not allowed",
  });

/**
 * Schema for file upload validation
 */
export const fileUploadSchema = z.object({
  files: z.array(fileSchema).min(1, "At least one file is required"),
  tags: z.array(z.string()).optional(),
  collection: z.string().optional(),
});

export type FileUploadData = z.infer<typeof fileUploadSchema>;

/**
 * Validate files client-side before upload
 */
export function validateFiles(files: File[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  files.forEach((file) => {
    if (file.size > MAX_FILE_SIZE) {
      errors.push(
        `${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      );
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
      errors.push(`${file.name} is not a supported file type`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse comma-separated tags
 */
export function parseTags(tagString: string): string[] {
  return tagString
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
