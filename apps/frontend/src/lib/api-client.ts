const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
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
  onEvent: (event: SseEvent<T>) => void | Promise<void>;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface StreamController {
  cancel: () => void;
}

function resolveUrl(path: string, query?: FetchOptions["query"]): string {
  const isAbsolute = /^https?:\/\//i.test(path);
  const url = new URL(isAbsolute ? path : `${API_BASE_URL}${path}`);
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
    throw new ApiError(
      `API request failed with status ${response.status}`,
      response.status,
      detail
    );
  }
  if (response.status === 204) {
    return null as T;
  }
  return parseJson<T>(response);
}

export async function apiFetch<T = unknown>(
  path: string,
  { query, headers, credentials = "include", ...init }: FetchOptions = {}
): Promise<T> {
  const url = resolveUrl(path, query);
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    credentials,
  });
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
      const response = await fetch(url, {
        method: options.method || "POST",
        body: JSON.stringify(body),
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          ...(options.headers || {}),
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
            await handlers.onEvent(event);
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

export { API_BASE_URL };

