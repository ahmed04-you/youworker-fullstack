import { z } from "zod";

/**
 * Schema for session rename
 */
export const sessionRenameSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
});

export type SessionRenameData = z.infer<typeof sessionRenameSchema>;

/**
 * Schema for message input
 */
export const messageInputSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message must be less than 10000 characters"),
});

export type MessageInputData = z.infer<typeof messageInputSchema>;

/**
 * Schema for chat configuration
 */
export const chatConfigSchema = z.object({
  model: z.string().min(1, "Model is required"),
  enableTools: z.boolean(),
  expectAudio: z.boolean(),
  assistantLanguage: z
    .string()
    .length(2, "Language must be a 2-letter code")
    .regex(/^[a-z]{2}$/, "Invalid language code"),
});

export type ChatConfigData = z.infer<typeof chatConfigSchema>;
