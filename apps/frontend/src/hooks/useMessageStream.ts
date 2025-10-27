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
