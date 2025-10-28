import { z } from "zod";

/**
 * File validation schemas for client-side validation
 */

export const fileValidationSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 100 * 1024 * 1024, {
      message: "File size must be less than 100MB",
    })
    .refine(
      (file) => {
        const allowedMimes = [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "image/jpeg",
          "image/png",
          "image/webp",
          "audio/mpeg",
          "audio/wav",
          "video/mp4",
        ];
        return allowedMimes.includes(file.type);
      },
      {
        message:
          "File type not supported. Allowed: PDF, TXT, MD, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG, WEBP, MP3, WAV, MP4",
      }
    ),
});

// FileList polyfill for SSR
const FileListConstructor = typeof FileList !== 'undefined' ? FileList : class FileList {};

export const multipleFilesValidationSchema = z.object({
  files: z
    .instanceof(FileListConstructor as any)
    .refine((files: any) => files.length > 0, {
      message: "At least one file is required",
    })
    .refine((files: any) => files.length <= 50, {
      message: "Maximum 50 files allowed",
    })
    .transform((files: any) => Array.from(files) as File[])
    .refine(
      (files: any) =>
        files.every((file: File) => file.size <= 100 * 1024 * 1024),
      {
        message: "Each file must be less than 100MB",
      }
    ),
});

export const sessionTitleSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters")
    .trim(),
});

export const tagSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .min(1, "Tag cannot be empty")
        .max(50, "Tag must be less than 50 characters")
        .trim()
    )
    .min(0)
    .max(20, "Maximum 20 tags allowed"),
});

export const searchSchema = z.object({
  query: z
    .string()
    .max(500, "Search query must be less than 500 characters")
    .optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export const collectionSchema = z.object({
  name: z
    .string()
    .min(1, "Collection name is required")
    .max(100, "Collection name must be less than 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

// Type exports for use in components
export type FileValidation = z.infer<typeof fileValidationSchema>;
export type MultipleFilesValidation = z.infer<typeof multipleFilesValidationSchema>;
export type SessionTitle = z.infer<typeof sessionTitleSchema>;
export type Tags = z.infer<typeof tagSchema>;
export type Search = z.infer<typeof searchSchema>;
export type Collection = z.infer<typeof collectionSchema>;