import { z } from "zod";

export const chatMessageSchema = z.object({
  text_input: z.string().min(1, "Message cannot be empty").max(10000, "Message too long"),
  enable_tools: z.boolean().default(true),
  model: z.string().min(1, "Model is required"),
  expect_audio: z.boolean().default(false),
});

export const voiceMessageSchema = z.object({
  audio_b64: z.string().min(1, "Audio data is required"),
  sample_rate: z.number().int().positive().default(16000),
  enable_tools: z.boolean().default(true),
  model: z.string().min(1, "Model is required"),
  expect_audio: z.boolean().default(true),
});

export const sessionRenameSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(200, "Title too long"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type VoiceMessageInput = z.infer<typeof voiceMessageSchema>;
export type SessionRenameInput = z.infer<typeof sessionRenameSchema>;
