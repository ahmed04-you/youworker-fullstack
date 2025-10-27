import { formatDistanceToNow, format } from "date-fns";

/**
 * Format time in HH:mm format
 */
export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

/**
 * Format date in relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format date and time in a readable format
 */
export function formatDateTime(date: Date): string {
  return format(date, "PPp"); // e.g., "Apr 29, 2023, 9:30 AM"
}

/**
 * Format date only
 */
export function formatDate(date: Date): string {
  return format(date, "PP"); // e.g., "Apr 29, 2023"
}

/**
 * Format full timestamp with relative time
 * Returns both absolute time and relative time (e.g., "9:30 AM (2 minutes ago)")
 */
export function formatFullTimestamp(date: Date): {
  time: string;
  relative: string;
  full: string;
} {
  return {
    time: formatTime(date),
    relative: formatRelativeTime(date),
    full: formatDateTime(date),
  };
}
