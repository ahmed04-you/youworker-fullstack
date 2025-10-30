/**
 * Utility functions for normalizing API responses
 */
import { ChatToolEvent, ChatLogEntry } from "@/lib/types";

/**
 * Extracts token text from streaming response
 * @param data - Raw token data from stream
 * @returns Extracted text string
 */
export function getTokenText(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object" && data !== null && "text" in data) {
    const value = (data as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  return "";
}

/**
 * Normalizes tool events from streaming responses
 * @param source - Raw tool events from API
 * @returns Array of normalized ChatToolEvent objects
 */
export function normalizeToolEvents(source: unknown): ChatToolEvent[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const tool = typeof candidate.tool === "string" ? candidate.tool : undefined;
      const status = typeof candidate.status === "string" ? candidate.status : undefined;
      if (!tool || !status) {
        return null;
      }
      const normalized: ChatToolEvent = {
        tool,
        status,
      };
      if (candidate.latency_ms && typeof candidate.latency_ms === "number") {
        normalized.latency_ms = candidate.latency_ms;
      }
      if (candidate.result_preview && typeof candidate.result_preview === "string") {
        normalized.result_preview = candidate.result_preview;
      }
      if (candidate.ts && typeof candidate.ts === "string") {
        normalized.ts = candidate.ts;
      }
      if (candidate.args && typeof candidate.args === "object") {
        normalized.args = candidate.args as Record<string, unknown>;
      }
      return normalized;
    })
    .filter((entry): entry is ChatToolEvent => entry !== null);
}

/**
 * Normalizes log entries from streaming responses
 * @param source - Raw log entries from API
 * @returns Array of normalized ChatLogEntry objects
 */
export function normalizeLogEntries(source: unknown): ChatLogEntry[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const value = item as Record<string, unknown>;
      const level = typeof value.level === "string" ? value.level : undefined;
      const msg = typeof value.msg === "string" ? value.msg : undefined;
      if (!level || !msg) {
        return null;
      }
      const normalized: ChatLogEntry = { level, msg };
      return normalized;
    })
    .filter((entry): entry is ChatLogEntry => entry !== null);
}

/**
 * Generic normalizer for type-safe array processing
 * @param source - Raw array from API
 * @param validator - Function to validate and transform each item
 * @returns Normalized and validated array
 */
export function normalizeArray<T>(
  source: unknown,
  validator: (item: unknown) => T | null
): T[] {
  if (!Array.isArray(source)) return [];
  return source.map(validator).filter((item): item is T => item !== null);
}