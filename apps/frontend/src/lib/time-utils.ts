/**
 * Time formatting utilities for relative and absolute timestamps
 */

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  } else {
    return `${diffYears}y ago`;
  }
}

export function formatAbsoluteTime(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  return targetDate.toLocaleString();
}

export function formatTimeWithRelative(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const relative = formatRelativeTime(targetDate);
  const absolute = formatAbsoluteTime(targetDate);
  return `${relative} (${absolute})`;
}

export function formatTimeShort(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  return targetDate.toLocaleDateString();
}

export function formatTimeWithTime(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  return targetDate.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}