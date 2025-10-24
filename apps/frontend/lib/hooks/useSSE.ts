/**
 * Server-Sent Events (SSE) hook for real-time streaming.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface SSEEvent {
  event: string;
  data: any;
  id?: string;
  retry?: number;
}

export interface UseSSEOptions {
  onMessage?: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
  autoConnect?: boolean;
}

export interface UseSSEReturn {
  connect: (url: string, options?: RequestInit) => void;
  disconnect: () => void;
  isConnected: boolean;
  error: Error | null;
  lastEvent: SSEEvent | null;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const {
    onMessage,
    onError,
    onOpen,
    onClose,
    autoConnect = false,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }

    setIsConnected(false);
    onClose?.();
  }, [onClose]);

  const connect = useCallback(
    async (url: string, fetchOptions: RequestInit = {}) => {
      // Disconnect existing connection
      disconnect();

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: abortControllerRef.current.signal,
          headers: {
            ...fetchOptions.headers,
            Accept: "text/event-stream",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setIsConnected(true);
        setError(null);
        onOpen?.();

        // Process SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is null");
        }

        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            disconnect();
            break;
          }

          // Decode chunk
          buffer += decoder.decode(value, { stream: true });

          // Process complete events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          let currentEvent: Partial<SSEEvent> = { event: "message" };

          for (const line of lines) {
            if (line.trim() === "") {
              // Empty line signals end of event
              if (currentEvent.data !== undefined) {
                const event: SSEEvent = {
                  event: currentEvent.event || "message",
                  data: currentEvent.data,
                  id: currentEvent.id,
                  retry: currentEvent.retry,
                };

                setLastEvent(event);
                onMessage?.(event);
              }
              currentEvent = { event: "message" };
              continue;
            }

            if (line.startsWith(":")) {
              // Comment line, ignore
              continue;
            }

            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) continue;

            const field = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            switch (field) {
              case "event":
                currentEvent.event = value;
                break;
              case "data":
                try {
                  currentEvent.data = JSON.parse(value);
                } catch {
                  currentEvent.data = value;
                }
                break;
              case "id":
                currentEvent.id = value;
                break;
              case "retry":
                currentEvent.retry = parseInt(value, 10);
                break;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Connection was aborted
          return;
        }

        const error = err instanceof Error ? err : new Error("SSE connection failed");
        setError(error);
        setIsConnected(false);
        onError?.(error);
      }
    },
    [disconnect, onMessage, onError, onOpen]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    error,
    lastEvent,
  };
}
