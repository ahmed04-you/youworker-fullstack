import { useCallback, useRef } from "react";
import { postEventStream, StreamController } from "@/lib/api-client";
import { UnifiedChatStreamPayload, ChatToolEvent } from "@/lib/types";
import { getTokenText, normalizeToolEvents, normalizeLogEntries } from "@/lib/utils/normalize";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  streaming?: boolean;
  toolCallName?: string | null;
}

interface UseMessageStreamOptions {
  onUpdateMessage: (id: string, content: string, streaming: boolean) => void;
  onAddToolEvent: (event: ChatToolEvent) => void;
  onAddLogEntry: (entry: any) => void;
  onSetTranscript: (transcript: string | null) => void;
  onSetSttMeta: (meta: { confidence?: number; language?: string }) => void;
  onPlayAudio: (audioB64: string | null | undefined) => void;
  onFinish: () => Promise<void>;
  onError: (error: Error) => void;
  messagesRef: React.MutableRefObject<ConversationMessage[]>;
}

/**
 * Hook for managing server-sent event (SSE) streaming of AI chat responses.
 * Handles token streaming, tool events, logs, transcripts, and audio responses.
 *
 * @param options - Configuration object with event handlers
 * @param options.onUpdateMessage - Called when new tokens arrive to update message content
 * @param options.onAddToolEvent - Called when tool execution events occur
 * @param options.onAddLogEntry - Called when log entries are received
 * @param options.onSetTranscript - Called when speech-to-text transcript is received
 * @param options.onSetSttMeta - Called with STT metadata (confidence, language)
 * @param options.onPlayAudio - Called with base64 audio for text-to-speech playback
 * @param options.onFinish - Called when streaming completes successfully
 * @param options.onError - Called when an error occurs during streaming
 * @param options.messagesRef - Mutable ref to current messages array
 *
 * @returns Object containing:
 *  - startStream: Function to initiate a new stream with the given payload
 *
 * @example
 * ```tsx
 * const { startStream } = useMessageStream({
 *   onUpdateMessage: (id, content, streaming) => updateMsg(id, content, streaming),
 *   onAddToolEvent: (event) => addToolEvent(event),
 *   onFinish: async () => await refreshData(),
 *   onError: (error) => showError(error.message),
 *   messagesRef,
 * });
 *
 * const controller = startStream(assistantId, { text_input: "Hello", stream: true });
 * ```
 */
export function useMessageStream(options: UseMessageStreamOptions) {
  const {
    onUpdateMessage,
    onAddToolEvent,
    onAddLogEntry,
    onSetTranscript,
    onSetSttMeta,
    onPlayAudio,
    onFinish,
    onError,
    messagesRef,
  } = options;

  const startStream = useCallback(
    (assistantMessageId: string, payload: any): StreamController => {
      const controller = postEventStream<UnifiedChatStreamPayload>(
        "/v1/unified-chat",
        payload,
        {
          onEvent: async (event) => {
            if (event.event === "token") {
              const tokenText = getTokenText(event.data);
              if (tokenText) {
                const currentMsg = messagesRef.current.find(
                  (m) => m.id === assistantMessageId
                );
                if (currentMsg) {
                  onUpdateMessage(
                    assistantMessageId,
                    currentMsg.content + String(tokenText),
                    true
                  );
                }
              }
            } else if (event.event === "tool") {
              const [eventData] = normalizeToolEvents([event.data as ChatToolEvent]);
              if (eventData) {
                onAddToolEvent(eventData);
              }
            } else if (event.event === "log") {
              const [logEntry] = normalizeLogEntries([event.data]);
              if (logEntry) {
                onAddLogEntry(logEntry);
              }
            } else if (event.event === "done") {
              const data = event.data as UnifiedChatStreamPayload;
              const currentMsg = messagesRef.current.find(
                (m) => m.id === assistantMessageId
              );
              onUpdateMessage(
                assistantMessageId,
                data.content || data.final_text || currentMsg?.content || "",
                false
              );

              if (data.tool_events) {
                const normalized = normalizeToolEvents(data.tool_events);
                normalized.forEach(onAddToolEvent);
              }

              const normalizedLogs = normalizeLogEntries(data.logs);
              normalizedLogs.forEach(onAddLogEntry);

              if (data.transcript) {
                onSetTranscript(data.transcript);
                onSetSttMeta({
                  confidence: data.stt_confidence ?? undefined,
                  language: data.stt_language ?? undefined,
                });
              }

              onPlayAudio(data.audio_b64);
              await onFinish();
            } else if (event.event === "error") {
              onError(new Error("Streaming error"));
            }
          },
          onError: (error) => {
            console.error("Streaming error", error);
            onError(error);
          },
        }
      );

      return controller;
    },
    [
      onUpdateMessage,
      onAddToolEvent,
      onAddLogEntry,
      onSetTranscript,
      onSetSttMeta,
      onPlayAudio,
      onFinish,
      onError,
      messagesRef,
    ]
  );

  return { startStream };
}
