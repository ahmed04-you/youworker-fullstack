/**
 * Chat API service
 */

import { apiGet, apiPost, apiPatch, apiDelete, API_BASE_URL } from './client';
import type {
  ChatSession,
  SessionListResponse,
  SessionDetailResponse,
  UpdateSessionRequest,
  SimpleChatRequest,
  SimpleChatResponse,
  UnifiedChatRequest,
  UnifiedChatResponse,
  SSELogEvent,
  SSEDoneEvent,
  SSETokenEvent,
  SSEToolEvent,
} from '../types';

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get all chat sessions for the current user
 */
export async function getSessions(): Promise<SessionListResponse> {
  return apiGet<SessionListResponse>('/v1/sessions');
}

/**
 * Get a specific session with its messages
 */
export async function getSession(sessionId: number | string): Promise<SessionDetailResponse> {
  return apiGet<SessionDetailResponse>(`/v1/sessions/${sessionId}`);
}

/**
 * Update a session (e.g., change title)
 */
export async function updateSession(
  sessionId: number | string,
  data: UpdateSessionRequest
): Promise<ChatSession> {
  return apiPatch<ChatSession>(`/v1/sessions/${sessionId}`, data);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: number | string): Promise<void> {
  return apiDelete<void>(`/v1/sessions/${sessionId}`);
}

// ============================================================================
// Chat Operations
// ============================================================================

/**
 * Send a simple chat message (non-streaming)
 */
export async function sendSimpleChat(
  request: SimpleChatRequest
): Promise<SimpleChatResponse> {
  return apiPost<SimpleChatResponse>('/v1/simple-chat', request);
}

/**
 * Send a unified chat message (non-streaming)
 */
export async function sendUnifiedChat(
  request: UnifiedChatRequest
): Promise<UnifiedChatResponse> {
  return apiPost<UnifiedChatResponse>('/v1/unified-chat', {
    ...request,
    stream: false,
  });
}

// ============================================================================
// Server-Sent Events (SSE) Streaming
// ============================================================================

export interface StreamCallbacks {
  onLog?: (log: SSELogEvent) => void;
  onToken?: (token: SSETokenEvent) => void;
  onTool?: (event: SSEToolEvent) => void;
  onDone?: (response: SSEDoneEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Send a unified chat message with SSE streaming
 */
export async function sendUnifiedChatStreaming(
  request: UnifiedChatRequest,
  callbacks: StreamCallbacks,
  csrfToken?: string
): Promise<void> {
  const url = `${API_BASE_URL}/v1/unified-chat`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      ...request,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`HTTP ${response.status}: ${errorText}`);
    callbacks.onError?.(error);
    throw error;
  }

  // Process SSE stream
  await processSSEStream(response.body, callbacks);
}

/**
 * Send a streaming chat request
 */
export async function sendChatStreaming(
  request: SimpleChatRequest,
  callbacks: StreamCallbacks,
  csrfToken?: string
): Promise<void> {
  const url = `${API_BASE_URL}/v1/chat`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      messages: request.messages || [{ role: 'user', content: request.message }],
      session_id: request.session_id,
      enable_tools: request.enable_tools ?? true,
      model: request.model,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`HTTP ${response.status}: ${errorText}`);
    callbacks.onError?.(error);
    throw error;
  }

  // Process SSE stream
  await processSSEStream(response.body, callbacks);
}

/**
 * Process SSE stream from response body
 */
async function processSSEStream(
  body: ReadableStream<Uint8Array> | null,
  callbacks: StreamCallbacks
): Promise<void> {
  if (!body) {
    throw new Error('No response body');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentDataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        if (currentEvent && currentDataLines.length > 0) {
          handleSSEEvent(currentEvent, currentDataLines.join('\n'), callbacks);
        }
        callbacks.onComplete?.();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (!line) {
          if (currentEvent && currentDataLines.length > 0) {
            handleSSEEvent(currentEvent, currentDataLines.join('\n'), callbacks);
          }
          currentEvent = '';
          currentDataLines = [];
          continue;
        }

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentDataLines.push(line.slice(5).trimStart());
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Handle a single SSE event
 */
function handleSSEEvent(event: string, data: string, callbacks: StreamCallbacks): void {
  try {
    const parsed = data ? JSON.parse(data) : {};

    switch (event) {
      case 'log':
        callbacks.onLog?.(parsed as SSELogEvent);
        break;
      case 'token':
        callbacks.onToken?.(parsed as SSETokenEvent);
        break;
      case 'tool':
        callbacks.onTool?.(parsed as SSEToolEvent);
        break;
      case 'done':
        callbacks.onDone?.(parsed as SSEDoneEvent);
        break;
      default:
        console.warn('Unknown SSE event type:', event);
    }
  } catch (error) {
    console.error('Failed to parse SSE event:', error);
    callbacks.onError?.(
      error instanceof Error ? error : new Error('Failed to parse SSE event')
    );
  }
}
