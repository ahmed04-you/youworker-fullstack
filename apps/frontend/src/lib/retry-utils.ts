/**
 * Retry logic utilities for React Query and API calls
 */

export interface RetryConfig {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Calculate exponential backoff delay
 */
export function getRetryDelay(
  attempt: number,
  config: RetryConfig = {}
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const delay = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1);
  return Math.min(delay, finalConfig.maxDelayMs);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < finalConfig.maxRetries) {
        const delay = getRetryDelay(attempt, config);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // HTTP status codes that should be retried
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  // Timeout errors
  if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
    return true;
  }

  return false;
}

/**
 * React Query retry configuration
 */
export const queryRetryConfig = {
  retry: (failureCount: number, error: any) => {
    if (failureCount > 3) return false;
    return isRetryableError(error);
  },
  retryDelay: (attemptIndex: number) => {
    return getRetryDelay(attemptIndex + 1);
  },
};