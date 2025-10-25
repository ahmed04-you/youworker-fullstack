/**
 * Chat state management hook with SSE streaming support.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage } from "../types";

export interface UseChatOptions {
  apiUrl?: string;
  onError?: (error: Error) => void;
  onMessage?: (message: ChatMessage) => void;
  onComplete?: (finalMessage: string) => void;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  streamingMessage: string;
  toolEvents: ToolEvent[];
}

export interface ToolEvent {
  tool: string;
  status: "start" | "end" | "error";
  args?: any;
  result?: any;
  latency_ms?: number;
  ts: string;
}

export interface UseChatReturn {
  state: ChatState;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
}

export interface SendMessageOptions {
  enableTools?: boolean;
  model?: string;
  sessionId?: string;
  assistantLanguage?: string;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { apiUrl = "", onError, onMessage, onComplete } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    streamingMessage: "",
    toolEvents: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
    onMessage?.(message);
  }, [onMessage]);

  const updateLastMessage = useCallback((content: string) => {
    setState((prev) => {
      const messages = [...prev.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      return { ...prev, messages };
    });
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      streamingMessage: "",
      toolEvents: [],
      error: null,
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string, sendOptions: SendMessageOptions = {}) => {
      const {
        enableTools = true,
        model,
        sessionId: providedSessionId,
        assistantLanguage,
      } = sendOptions;

      // Ensure stable session ID
      if (!sessionIdRef.current) {
        sessionIdRef.current = providedSessionId || Date.now().toString();
      } else if (providedSessionId && providedSessionId !== sessionIdRef.current) {
        sessionIdRef.current = providedSessionId;
      }
      const effectiveSessionId = sessionIdRef.current;

      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        role: "user",
        content,
      };

      // Add user message immediately
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
        streamingMessage: "",
        toolEvents: [],
      }));

      // Add placeholder assistant message for streaming
      const placeholderAssistant: ChatMessage = {
        id: Date.now().toString() + '_streaming',
        createdAt: new Date().toISOString(),
        role: "assistant",
        content: "",
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, placeholderAssistant],
      }));

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        const response = await fetch(`${apiUrl}/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...state.messages, userMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            stream: true,
            enable_tools: enableTools,
            model,
            session_id: effectiveSessionId,
            assistant_language: assistantLanguage,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";

        if (!reader) {
          throw new Error("Response body is null");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim() || line.startsWith(":")) continue;

            if (line.startsWith("event:")) {
              const eventType = line.substring(6).trim();
              continue;
            }

            if (line.startsWith("data:")) {
              try {
                const data = JSON.parse(line.substring(5).trim());

                // Handle different event types
                if (data.text) {
                  // Token event
                  streamedContent += data.text;
                  // Update the placeholder assistant message content progressively
                  setState((prev) => {
                    const messages = [...prev.messages];
                    if (messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content !== streamedContent) {
                      messages[messages.length - 1] = {
                        ...messages[messages.length - 1],
                        content: streamedContent,
                      };
                    }
                    return { ...prev, messages, streamingMessage: streamedContent };
                  });
                } else if (data.tool) {
                  // Tool event
                  setState((prev) => ({
                    ...prev,
                    toolEvents: [...prev.toolEvents, data as ToolEvent],
                  }));
                } else if (data.final_text !== undefined) {
                  // Done event - update the existing placeholder with final content
                  const finalContent = data.final_text || streamedContent;

                  setState((prev) => {
                    const messages = [...prev.messages];
                    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
                      messages[messages.length - 1] = {
                        ...messages[messages.length - 1],
                        id: Date.now().toString(), // Update ID to final
                        content: finalContent,
                      };
                    }
                    return { ...prev, messages, streamingMessage: "", isLoading: false };
                  });

                  // Trigger callbacks with final message
                  const finalMessage: ChatMessage = {
                    id: Date.now().toString(),
                    createdAt: new Date().toISOString(),
                    role: "assistant",
                    content: finalContent,
                  };
                  onMessage?.(finalMessage);
                  onComplete?.(finalContent);
                }
              } catch (parseError) {
                console.error("Failed to parse SSE data:", parseError);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted
          return;
        }

        const err = error instanceof Error ? error : new Error("Unknown error");
        setState((prev) => ({
          ...prev,
          error: err,
          isLoading: false,
        }));
        onError?.(err);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [apiUrl, state.messages, onError, onMessage, onComplete]
  );

  return {
    state,
    sendMessage,
    stopStreaming,
    clearMessages,
    addMessage,
    updateLastMessage,
  };
}
