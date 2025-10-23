import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind-aware class name merger.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a collision-resistant identifier for UI elements.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const rand = Math.random().toString(16).slice(2)
  return `id-${Date.now().toString(16)}-${rand}`
}

/**
 * Clamp a numeric value between provided bounds.
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Safely parse JSON coming from localStorage.
 */
export function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Persist a value to localStorage, ignoring quota errors.
 */
export function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore write failures (private browsing, quota exceeded, etc.)
  }
}

/**
 * Retrieve a JSON value from localStorage.
 */
export function readFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback
  }
  return safeParseJSON(localStorage.getItem(key), fallback)
}
