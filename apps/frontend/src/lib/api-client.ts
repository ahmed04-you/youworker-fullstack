const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const INTERNAL_API_BASE_URL = process.env.NEXT_INTERNAL_API_BASE_URL;
const CSRF_HEADER_NAME = "X-CSRF-Token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

let csrfToken: string | null = null;
let csrfTokenExpiresAt: number | null = null;
let csrfTokenPromise: Promise<string> | null = null;

function getApiBaseUrl(): string {
  const isServer = typeof window === "undefined";
  const serverUrl = INTERNAL_API_BASE_URL || PUBLIC_API_BASE_URL || "http://api:8001";
  const clientUrl = PUBLIC_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

  if (isServer) {
    return serverUrl;
  }
  return clientUrl;
}

export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  AUTH = 'auth',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  readonly type: ErrorType;

  constructor(message: string, status: number, details?: unknown, type?: ErrorType) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.type = type || ApiError.inferErrorType(status);
  }

  static inferErrorType(status: number): ErrorType {
    if (status === 0) return ErrorType.NETWORK;
    if (status === 401 || status === 403) return ErrorType.AUTH;
    if (status === 404) return ErrorType.NOT_FOUND;
    if (status === 408) return ErrorType.TIMEOUT;
    if (status === 429) return ErrorType.RATE_LIMIT;
    if (status === 422 || status === 400) return ErrorType.VALIDATION;
    if (status >= 500) return ErrorType.SERVER;
    if (status >= 400) return ErrorType.API;
    return ErrorType.UNKNOWN;
  }

  static getUserFriendlyMessage(error: ApiError): string {
    // Try to extract a message from the error details if available
    const detailMessage =
      error.details && typeof error.details === 'object' && 'detail' in error.details
        ? (error.details as { detail: string }).detail
        : null;

    switch (error.type) {
      case ErrorType.AUTH:
        if (error.status === 401) {
          return 'Please log in to continue. Your session may have expired.';
        }
        return 'You do not have permission to perform this action.';
      case ErrorType.VALIDATION:
        if (detailMessage) {
          return `Invalid input: ${detailMessage}`;
        }
        return 'Please check your input and try again.';
      case ErrorType.NOT_FOUND:
        return 'The requested resource could not be found. It may have been moved or deleted.';
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please check your connection and try again.';
      case ErrorType.SERVER:
        if (error.status === 503) {
          return 'Service temporarily unavailable. Please try again in a few moments.';
        }
        return 'A server error occurred. Our team has been notified. Please try again later.';
      case ErrorType.NETWORK:
        // Check if it might be an SSL certificate issue
        if (error.message?.includes('SSL') || error.message?.includes('certificate') || error.message?.includes('HTTPS')) {
          return 'Unable to connect: SSL certificate error. If using a development server, try using HTTP instead of HTTPS.';
        }
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case ErrorType.API:
        if (detailMessage) {
          return detailMessage;
        }
        return 'An error occurred while processing your request. Please try again.';
      default:
        return detailMessage || error.message || 'An unexpected error occurred. Please try again.';
    }
  }
}

export interface FetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
  raw: string;
}

export interface StreamHandlers<T = unknown> {
  onEvent: (event: SseEvent<T>) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface StreamController {
  cancel: () => void;
}

function resolveUrl(path: string, query?: FetchOptions["query"]): string {
  const apiBaseUrl = getApiBaseUrl();
  const isAbsolute = /^https?:\/\//i.test(path);
  const url = new URL(isAbsolute ? path : `${apiBaseUrl}${path}`);
  if (query) {
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  return url.toString();
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return null as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError("Invalid JSON response received from API", response.status, {
      raw: text,
    });
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: unknown = undefined;
    try {
      detail = await parseJson(response);
    } catch {
      /* ignore parse error */
    }

    // Create error with appropriate message based on status
    const error = new ApiError(
      `API request failed with status ${response.status}`,
      response.status,
      detail
    );

    // Use the user-friendly message for better error reporting
    error.message = ApiError.getUserFriendlyMessage(error);
    throw error;
  }
  if (response.status === 204) {
    return null as T;
  }
  return parseJson<T>(response);
}

interface CsrfTokenResponse {
  csrf_token: string;
  expires_at?: string;
}

function invalidateCsrfToken() {
  csrfToken = null;
  csrfTokenExpiresAt = null;
}

function csrfTokenIsFresh(): boolean {
  if (!csrfToken) {
    return false;
  }
  if (!csrfTokenExpiresAt) {
    return true;
  }
  const now = Date.now();
  // Refresh token slightly before expiry to avoid race conditions.
  return now + 30_000 < csrfTokenExpiresAt;
}

async function loadCsrfToken(): Promise<string> {
  const url = resolveUrl("/v1/auth/csrf-token");
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await handleResponse<CsrfTokenResponse>(response);
  if (!data || !data.csrf_token) {
    throw new ApiError("CSRF token endpoint returned an invalid response", response.status, data);
  }

  csrfToken = data.csrf_token;
  if (data.expires_at) {
    const parsed = Date.parse(data.expires_at);
    csrfTokenExpiresAt = Number.isFinite(parsed) ? parsed : null;
  } else {
    csrfTokenExpiresAt = null;
  }
  return csrfToken;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfTokenIsFresh()) {
    return csrfToken as string;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = loadCsrfToken()
      .catch((error) => {
        invalidateCsrfToken();
        throw error;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  { query, headers, credentials = "include", ...init }: FetchOptions = {}
): Promise<T> {
  const url = resolveUrl(path, query);
  const method = (init.method || "GET").toUpperCase();

  const normalizedHeaders: Record<string, string> = (() => {
    if (!headers) {
      return {};
    }
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return headers;
  })();

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...normalizedHeaders,
  };

  if (!SAFE_METHODS.has(method) && !requestHeaders[CSRF_HEADER_NAME]) {
    const token = await ensureCsrfToken();
    requestHeaders[CSRF_HEADER_NAME] = token;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      method,
      headers: requestHeaders,
      credentials,
    });
  } catch (error) {
    // Network errors (connection failed, timeout, etc.)
    throw new ApiError(
      'Network error: Unable to connect to the server',
      0,
      error,
      ErrorType.NETWORK
    );
  }

  if (!response.ok && response.status === 403 && !SAFE_METHODS.has(method)) {
    invalidateCsrfToken();
  }

  return handleResponse<T>(response);
}

export function apiGet<T = unknown>(path: string, options?: FetchOptions) {
  return apiFetch<T>(path, { ...options, method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: unknown, options?: FetchOptions) {
  return apiFetch<T>(path, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T = unknown>(path: string, body?: unknown, options?: FetchOptions) {
  return apiFetch<T>(path, {
    ...options,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = unknown>(path: string, options?: FetchOptions) {
  return apiFetch<T>(path, { ...options, method: "DELETE" });
}

export async function apiPostMultipart<T = unknown>(
  path: string,
  formData: FormData,
  options?: FetchOptions
): Promise<T> {
  const url = resolveUrl(path, options?.query);

  const requestHeaders: Record<string, string> = {};

  // Get CSRF token for non-safe methods
  const token = await ensureCsrfToken();
  requestHeaders[CSRF_HEADER_NAME] = token;

  // Add any additional headers from options
  if (options?.headers) {
    const normalizedHeaders = options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : Array.isArray(options.headers)
      ? Object.fromEntries(options.headers)
      : options.headers;
    Object.assign(requestHeaders, normalizedHeaders);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: requestHeaders,
      credentials: options?.credentials || "include",
    });
  } catch (error) {
    // Enhanced error message with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const detailedMessage = `Network error: Unable to connect to ${url}. ${errorMessage}`;

    // Log the error for debugging
    console.error('API Network Error:', {
      url,
      error,
      timestamp: new Date().toISOString()
    });

    throw new ApiError(
      detailedMessage,
      0,
      error,
      ErrorType.NETWORK
    );
  }

  if (!response.ok && response.status === 403) {
    invalidateCsrfToken();
  }

  return handleResponse<T>(response);
}

function parseSseChunk<T = unknown>(chunk: string): SseEvent<T> {
  let eventName = "message";
  const dataLines: string[] = [];

  chunk.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  });

  const dataText = dataLines.join("\n");
  let data: T | string = dataText as string;

  if (dataText) {
    try {
      data = JSON.parse(dataText) as T;
    } catch {
      /* keep raw string */
    }
  } else {
    data = null as T;
  }

  return {
    event: eventName,
    data: data as T,
    raw: chunk,
  };
}

export function postEventStream<T = unknown>(
  path: string,
  body: unknown,
  handlers: StreamHandlers<T>,
  options: FetchOptions = {}
): StreamController {
  const controller = new AbortController();
  const url = resolveUrl(path, options.query);

  (async () => {
    try {
      const csrfHeader =
        options.method && SAFE_METHODS.has(options.method.toUpperCase())
          ? undefined
          : await ensureCsrfToken();

      const response = await fetch(url, {
        method: options.method || "POST",
        body: JSON.stringify(body),
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          ...(options.headers || {}),
          ...(csrfHeader ? { [CSRF_HEADER_NAME]: csrfHeader } : {}),
        },
        credentials: options.credentials || "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await parseJson(response).catch(() => undefined);
        throw new ApiError(
          `Streaming request failed with status ${response.status}`,
          response.status,
          errorPayload
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ApiError("Streaming response has no body", response.status);
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          handlers.onClose?.();
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawChunk = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (rawChunk) {
            const event = parseSseChunk<T>(rawChunk);
            // Fire and forget - don't block stream reading
            handlers.onEvent(event);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        handlers.onClose?.();
        return;
      }
      if (error instanceof Error) {
        handlers.onError?.(error);
      } else {
        handlers.onError?.(new Error("Unknown streaming error"));
      }
    }
  })();

  return {
    cancel: () => controller.abort(),
  };
}

export { getApiBaseUrl };
