"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { postEventStream } from "@/lib/api-client";
import {
  ChatLogEntry,
  ChatToolEvent,
  SessionMessage,
  SessionSummary,
  UnifiedChatStreamPayload,
} from "@/lib/types";
import {
  getTokenText,
  normalizeLogEntries,
  normalizeToolEvents,
} from "@/lib/utils/normalize";
import { toastError, toastInfo, toastWarning } from "@/lib/toast-helpers";

import type { ChatMessage, SpeechTranscriptMeta } from "../types";
import { useChatStore } from "../store/chat-store";
import type { ChatStore } from "../store/chat-store";
import {
  fetchSessionDetail,
  useDeleteSessionMutation,
  useRenameSessionMutation,
  useSessionsQuery,
} from "../api/session-service";
import { useHealthQuery } from "../api/health-service";

const STREAM_TIMEOUT_MS = 30_000;

function encodePcmChunks(chunks: Int16Array[]): string {
  const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const fullPcm = new Int16Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    fullPcm.set(chunk, offset);
    offset += chunk.length;
  }
  const pcmBytes = new Uint8Array(fullPcm.buffer);
  return btoa(String.fromCharCode(...pcmBytes));
}

function playAudio(audioB64: string | null | undefined) {
  if (!audioB64) return;

  const audio = new Audio(`data:audio/wav;base64,${audioB64}`);
  audio.play().catch((error) => {
    console.error("Audio playback failed", error);
  });
}

type ChatControllerSlice = Pick<
  ChatStore,
  |
    "sessions"
    | "sessionsLoading"
    | "activeSession"
    | "sessionIdentifier"
    | "messages"
    | "input"
    | "isStreaming"
    | "streamController"
    | "toolTimeline"
    | "logEntries"
    | "transcript"
    | "sttMeta"
    | "isRecording"
    | "enableTools"
    | "expectAudio"
    | "assistantLanguage"
    | "selectedModel"
    | "health"
    | "healthLoading"
> & {
  setSessions: ChatStore["setSessions"];
  setSessionsLoading: ChatStore["setSessionsLoading"];
  setActiveSession: ChatStore["setActiveSession"];
  setSessionIdentifier: ChatStore["setSessionIdentifier"];
  setMessages: ChatStore["setMessages"];
  addMessage: ChatStore["addMessage"];
  updateMessage: ChatStore["updateMessage"];
  setInput: ChatStore["setInput"];
  setStreamController: ChatStore["setStreamController"];
  setIsStreaming: ChatStore["setIsStreaming"];
  setToolTimeline: ChatStore["setToolTimeline"];
  setLogEntries: ChatStore["setLogEntries"];
  addToolEvent: ChatStore["addToolEvent"];
  addLogEntry: ChatStore["addLogEntry"];
  setTranscript: ChatStore["setTranscript"];
  setSttMeta: ChatStore["setSttMeta"];
  setIsRecording: ChatStore["setIsRecording"];
  setEnableTools: ChatStore["setEnableTools"];
  setExpectAudio: ChatStore["setExpectAudio"];
  setAssistantLanguage: ChatStore["setAssistantLanguage"];
  setSelectedModel: ChatStore["setSelectedModel"];
  setHealth: ChatStore["setHealth"];
  setHealthLoading: ChatStore["setHealthLoading"];
  clearStreamData: ChatStore["clearStreamData"];
  startNewSession: ChatStore["startNewSession"];
  getSessionHistory: ChatStore["getSessionHistory"];
  deriveSessionName: ChatStore["deriveSessionName"];
};

interface OptimisticStreamState {
  messages: ChatMessage[];
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];
  transcript: string | null;
  sttMeta: SpeechTranscriptMeta;
  inputValue?: string;
}

interface OptimisticStreamHandlers {
  setMessages: (messages: ChatMessage[]) => void;
  setToolTimeline: (events: ChatToolEvent[]) => void;
  setLogEntries: (entries: ChatLogEntry[]) => void;
  setTranscript: (transcript: string | null, meta?: SpeechTranscriptMeta) => void;
  setInput?: (value: string) => void;
  stopStreaming: () => void;
  reportError: (message: string) => void;
  logError: (error: unknown) => void;
}

/**
 * Creates a reusable error handler for stream failures with automatic rollback.
 * Used to restore optimistic UI updates when streaming fails.
 *
 * @param state - Snapshot of state before optimistic update
 * @param handlers - Object with rollback and error reporting functions
 * @returns Handler function that rolls back state and reports errors
 */
export function createStreamFailureHandler(
  state: OptimisticStreamState,
  handlers: OptimisticStreamHandlers
) {
  let stateRestored = false;
  let errorReported = false;

  return (message: string, error?: unknown) => {
    if (!stateRestored) {
      handlers.setMessages(state.messages);
      handlers.setToolTimeline(state.toolTimeline);
      handlers.setLogEntries(state.logEntries);
      handlers.setTranscript(state.transcript, state.sttMeta);
      if (handlers.setInput) {
        handlers.setInput(state.inputValue ?? "");
      }
      stateRestored = true;
    }

    if (!errorReported) {
      if (error) {
        handlers.logError(error);
      }
      handlers.reportError(message);
      errorReported = true;
    }

    handlers.stopStreaming();
  };
}

/**
 * Main controller hook for managing chat functionality.
 * Handles sessions, messages, streaming, voice recording, and health checks.
 *
 * Features:
 * - Session management (create, select, delete, rename)
 * - Text and voice message sending with streaming responses
 * - Real-time token streaming from AI responses
 * - Tool execution and logging
 * - Speech-to-text transcription
 * - Text-to-speech audio playback
 * - Optimistic UI updates with automatic rollback on error
 * - Voice recording with PCM encoding
 *
 * @returns Object containing:
 *  State:
 *  - sessions: List of chat sessions
 *  - sessionsLoading: Whether sessions are loading
 *  - activeSession: Currently selected session
 *  - sessionIdentifier: External ID of active session
 *  - messages: Array of chat messages in current session
 *  - input: Current text input value
 *  - isStreaming: Whether AI is currently streaming a response
 *  - streamController: Controller for canceling active stream
 *  - toolTimeline: Array of tool execution events
 *  - logEntries: Array of log entries from AI
 *  - transcript: Speech-to-text transcript
 *  - sttMeta: STT metadata (confidence, language)
 *  - isRecording: Whether voice recording is active
 *  - enableTools: Whether tools/MCP is enabled
 *  - expectAudio: Whether to expect audio response
 *  - assistantLanguage: Language for assistant responses
 *  - selectedModel: Currently selected AI model
 *  - health: Health status of backend services
 *  - healthLoading: Whether health check is loading
 *
 *  Actions:
 *  - setInput: Update text input value
 *  - setEnableTools: Toggle tools/MCP
 *  - setExpectAudio: Toggle audio responses
 *  - setAssistantLanguage: Set response language
 *  - setSelectedModel: Select AI model
 *  - refreshSessions: Refetch sessions list
 *  - fetchHealth: Refetch health status
 *  - loadSessionMessages: Load messages for a session
 *  - handleSelectSession: Switch to a different session
 *  - handleDeleteSession: Delete a session
 *  - renameSession: Rename a session
 *  - stopStreaming: Cancel active stream
 *  - handleSendText: Send a text message
 *  - startRecording: Start voice recording
 *  - stopRecording: Stop voice recording
 *  - startNewSession: Create and switch to new session
 *  - deriveSessionName: Generate session name from messages
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   input,
 *   isStreaming,
 *   setInput,
 *   handleSendText,
 *   startRecording,
 *   stopRecording,
 * } = useChatController();
 *
 * return (
 *   <>
 *     <MessageList messages={messages} />
 *     <input value={input} onChange={(e) => setInput(e.target.value)} />
 *     <button onClick={handleSendText} disabled={isStreaming}>Send</button>
 *     <button onMouseDown={startRecording} onMouseUp={stopRecording}>Voice</button>
 *   </>
 * );
 * ```
 */
export function useChatController() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStopResolverRef = useRef<(() => void) | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const {
    sessions,
    sessionsLoading,
    activeSession,
    sessionIdentifier,
    messages,
    input,
    isStreaming,
    streamController,
    toolTimeline,
    logEntries,
    transcript,
    sttMeta,
    isRecording,
    enableTools,
    expectAudio,
    assistantLanguage,
    selectedModel,
    health,
    healthLoading,
    setSessions,
    setSessionsLoading,
    setActiveSession,
    setSessionIdentifier,
    setMessages,
    addMessage,
    updateMessage,
    setInput,
    setStreamController,
    setIsStreaming,
    setToolTimeline,
    setLogEntries,
    addToolEvent,
    addLogEntry,
    setTranscript,
    setSttMeta,
    setIsRecording,
    setEnableTools,
    setExpectAudio,
    setAssistantLanguage,
    setSelectedModel,
    setHealth,
    setHealthLoading,
    clearStreamData,
    startNewSession,
    getSessionHistory,
    deriveSessionName,
  } = useChatStore((state) => ({
      sessions: state.sessions,
      sessionsLoading: state.sessionsLoading,
      activeSession: state.activeSession,
      sessionIdentifier: state.sessionIdentifier,
      messages: state.messages,
      input: state.input,
      isStreaming: state.isStreaming,
      streamController: state.streamController,
      toolTimeline: state.toolTimeline,
      logEntries: state.logEntries,
      transcript: state.transcript,
      sttMeta: state.sttMeta,
      isRecording: state.isRecording,
      enableTools: state.enableTools,
      expectAudio: state.expectAudio,
      assistantLanguage: state.assistantLanguage,
      selectedModel: state.selectedModel,
      health: state.health,
      healthLoading: state.healthLoading,
      setSessions: state.setSessions,
      setSessionsLoading: state.setSessionsLoading,
      setActiveSession: state.setActiveSession,
      setSessionIdentifier: state.setSessionIdentifier,
      setMessages: state.setMessages,
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      setInput: state.setInput,
      setStreamController: state.setStreamController,
      setIsStreaming: state.setIsStreaming,
      setToolTimeline: state.setToolTimeline,
      setLogEntries: state.setLogEntries,
      addToolEvent: state.addToolEvent,
      addLogEntry: state.addLogEntry,
      setTranscript: state.setTranscript,
      setSttMeta: state.setSttMeta,
      setIsRecording: state.setIsRecording,
      setEnableTools: state.setEnableTools,
      setExpectAudio: state.setExpectAudio,
      setAssistantLanguage: state.setAssistantLanguage,
      setSelectedModel: state.setSelectedModel,
      setHealth: state.setHealth,
      setHealthLoading: state.setHealthLoading,
      clearStreamData: state.clearStreamData,
      startNewSession: state.startNewSession,
      getSessionHistory: state.getSessionHistory,
      deriveSessionName: state.deriveSessionName,
    })) as ChatControllerSlice;

  const {
    data: sessionsData,
    refetch: refetchSessions,
    isLoading: sessionsLoadingQuery,
    isFetching: sessionsFetching,
  } = useSessionsQuery();
  const deleteSessionMutation = useDeleteSessionMutation();
  const renameSessionMutation = useRenameSessionMutation();
  const {
    data: healthData,
    isLoading: healthLoadingQuery,
    isFetching: healthFetching,
    refetch: refetchHealth,
  } = useHealthQuery({ enabled: isAuthenticated && !authLoading });

  const refreshSessions = useCallback(async () => {
    await refetchSessions();
  }, [refetchSessions]);

  useEffect(() => {
    setHealthLoading(healthLoadingQuery || healthFetching);
  }, [healthLoadingQuery, healthFetching, setHealthLoading]);

  useEffect(() => {
    if (healthData) {
      setHealth(healthData);
    }
  }, [healthData, setHealth]);

  const fetchHealth = useCallback(async () => {
    await refetchHealth();
  }, [refetchHealth]);

  const loadSessionMessages = useCallback(
    async (session: SessionSummary | null) => {
      if (!session || session.id <= 0) {
        setMessages([]);
        setToolTimeline([]);
        setLogEntries([]);
        return;
      }

      try {
        const detail = await fetchSessionDetail(session.id);
        const sortedMessages = [...detail.session.messages].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
        setEnableTools(detail.session.enable_tools);
        setSelectedModel(detail.session.model || selectedModel);
        setMessages(
          sortedMessages.map((message: SessionMessage) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            createdAt: new Date(message.created_at),
            toolCallName: message.tool_call_name,
          }))
        );
        setToolTimeline([]);
        setLogEntries([]);
        setTranscript(null);
      } catch (error) {
        console.error(error);
        toastError("Unable to load session history.");
      }
    },
    [
      setMessages,
      setToolTimeline,
      setLogEntries,
      setEnableTools,
      setSelectedModel,
      setTranscript,
      selectedModel,
    ]
  );

  useEffect(() => {
    setSessionsLoading(sessionsLoadingQuery || sessionsFetching);
  }, [sessionsLoadingQuery, sessionsFetching, setSessionsLoading]);

  useEffect(() => {
    const data = sessionsData;
    if (!data) {
      return;
    }

    setSessions(data);

    if (data.length === 0) {
      return;
    }

    const currentActive = useChatStore.getState().activeSession;

    if (
      currentActive &&
      currentActive.id > 0 &&
      data.some((session) => session.id === currentActive.id)
    ) {
      const updated = data.find((session) => session.id === currentActive.id);
      if (updated) {
        setActiveSession(updated);
        setSessionIdentifier(updated.external_id || String(updated.id));
      }
      return;
    }

    if (currentActive && currentActive.id <= 0) {
      return;
    }

    const next = data[0];
    setActiveSession(next);
    setSessionIdentifier(next.external_id || String(next.id));
    void loadSessionMessages(next);
  }, [sessionsData, setSessions, setActiveSession, setSessionIdentifier, loadSessionMessages]);

  const handleSelectSession = useCallback(
    async (session: SessionSummary) => {
      if (useChatStore.getState().isStreaming) {
        toastWarning("Please wait for the current response to finish.");
        return;
      }
      setActiveSession(session);
      setSessionIdentifier(session.external_id || String(session.id));
      await loadSessionMessages(session);
    },
    [setActiveSession, setSessionIdentifier, loadSessionMessages]
  );

  const handleDeleteSession = useCallback(
    async (session: SessionSummary) => {
      if (session.id <= 0) return;
      try {
        await deleteSessionMutation.mutateAsync(session.id);
        const currentActive = useChatStore.getState().activeSession;
        if (currentActive?.id === session.id) {
          startNewSession();
        }
      } catch (error) {
        console.error("Failed to delete session", error);
      }
    },
    [deleteSessionMutation, startNewSession]
  );

  const renameSession = useCallback(
    async (session: SessionSummary, title: string) => {
      if (session.id <= 0) return;
      const trimmed = title.trim();
      if (!trimmed || trimmed === session.title) return;
      try {
        await renameSessionMutation.mutateAsync({
          sessionId: session.id,
          title: trimmed,
        });
      } catch (error) {
        console.error("Failed to rename session", error);
      }
    },
    [renameSessionMutation]
  );

  const stopStreaming = useCallback(() => {
    const { streamController: controller, messages: currentMessages } =
      useChatStore.getState();
    controller?.cancel();
    setStreamController(null);
    setIsStreaming(false);
    const streamingMsg = currentMessages.find((msg) => msg.streaming);
    if (streamingMsg) {
      updateMessage(streamingMsg.id, { streaming: false });
    }
  }, [setStreamController, setIsStreaming, updateMessage]);

  const finishStreaming = useCallback(async () => {
    setIsStreaming(false);
    setStreamController(null);
    await refreshSessions();
  }, [setIsStreaming, setStreamController, refreshSessions]);

  const handleSendText = useCallback(async () => {
    const currentState = useChatStore.getState();
    if (currentState.isStreaming) {
      toastInfo("Hold on, still responding.");
      return;
    }
    const trimmed = currentState.input.trim();
    if (!trimmed) {
      return;
    }

    const rollbackState = {
      messages: currentState.messages.map((message) => ({ ...message })),
      toolTimeline: currentState.toolTimeline.map((event) => ({ ...event })),
      logEntries: currentState.logEntries.map((entry) => ({ ...entry })),
      transcript: currentState.transcript,
      sttMeta: { ...currentState.sttMeta },
      inputValue: currentState.input,
    };
    const handleStreamFailure = createStreamFailureHandler(rollbackState, {
      setMessages,
      setToolTimeline,
      setLogEntries,
      setTranscript,
      setInput,
      stopStreaming,
      reportError: (message) => {
        toastError(message);
      },
      logError: (error) => {
        if (error instanceof Error) {
          console.error("Streaming error", error);
        } else if (error) {
          console.error("Streaming error", error);
        }
      },
    });

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    };

    addMessage(userMessage);
    addMessage(assistantMessage);
    setInput("");
    clearStreamData();
    setIsStreaming(true);

    const snapshot = useChatStore.getState();
    const payload = {
      text_input: userMessage.content,
      messages: snapshot.getSessionHistory(),
      session_id: snapshot.sessionIdentifier,
      assistant_language: snapshot.assistantLanguage,
      enable_tools: snapshot.enableTools,
      model: snapshot.selectedModel,
      expect_audio: snapshot.expectAudio,
      stream: true,
    };

    const controller = postEventStream<UnifiedChatStreamPayload>(
      "/v1/unified-chat",
      payload,
      {
        onEvent: async (event) => {
          const store = useChatStore.getState();
          if (event.event === "token") {
            const tokenText = getTokenText(event.data);
            if (tokenText) {
              const currentMsg = store.messages.find(
                (message) => message.id === assistantMessage.id
              );
              if (currentMsg) {
                store.updateMessage(assistantMessage.id, {
                  content: currentMsg.content + String(tokenText),
                  streaming: true,
                });
              }
            }
          } else if (event.event === "tool") {
            const [eventData] = normalizeToolEvents([
              event.data as ChatToolEvent,
            ]);
            if (eventData) {
              store.addToolEvent(eventData);
            }
          } else if (event.event === "log") {
            const [logEntry] = normalizeLogEntries([event.data]);
            if (logEntry) {
              store.addLogEntry(logEntry);
            }
          } else if (event.event === "done") {
            const data = event.data as UnifiedChatStreamPayload;
            const currentMsg = store.messages.find(
              (message) => message.id === assistantMessage.id
            );
            store.updateMessage(assistantMessage.id, {
              content:
                data.content ||
                data.final_text ||
                currentMsg?.content ||
                "",
              streaming: false,
            });
            if (data.tool_events) {
              const normalized = normalizeToolEvents(data.tool_events);
              normalized.forEach(store.addToolEvent);
            }
            const normalizedLogs = normalizeLogEntries(data.logs);
            normalizedLogs.forEach(store.addLogEntry);
            store.setTranscript(data.transcript || null, {
              confidence: data.stt_confidence || undefined,
              language: data.stt_language || undefined,
            });
            playAudio(data.audio_b64);
            await finishStreaming();
          } else if (event.event === "error") {
            const eventMessage =
              typeof event.data === "string" && event.data
                ? event.data
                : "Streaming error";
            handleStreamFailure(eventMessage);
          }
        },
        onError: (error) => {
          handleStreamFailure(error.message || "Streaming failed.", error);
        },
      }
    );

    setStreamController(controller);
  }, [
    addMessage,
    setMessages,
    setToolTimeline,
    setLogEntries,
    setTranscript,
    setInput,
    clearStreamData,
    setIsStreaming,
    setStreamController,
    finishStreaming,
    stopStreaming,
  ]);

  const stopRecording = useCallback(() => {
    const context = audioContextRef.current;
    if (context) {
      context.close().catch((error) => {
        console.error("Failed to close audio context", error);
      });
    }
    audioContextRef.current = null;

    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    const resolver = recordingStopResolverRef.current;
    recordingStopResolverRef.current = null;
    if (resolver) {
      resolver();
    }
    setIsRecording(false);
  }, [setIsRecording]);

  const startRecording = useCallback(async () => {
    if (useChatStore.getState().isStreaming || useChatStore.getState().isRecording) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toastError("Audio recording is not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const context = new AudioContext({ sampleRate: 16_000 });
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4_096, 1, 1);
      const pcmData: Int16Array[] = [];

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
          const s = Math.max(-1, Math.min(1, inputBuffer[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        pcmData.push(pcm16);
      };

      source.connect(processor);
      processor.connect(context.destination);
      setIsRecording(true);

      await new Promise<void>((resolve) => {
        recordingStopResolverRef.current = resolve;
        setTimeout(() => {
          stopRecording();
        }, STREAM_TIMEOUT_MS);
      });

      const audioB64 = encodePcmChunks(pcmData);

      const stateBeforeSend = useChatStore.getState();
      const voiceRollbackState = {
        messages: stateBeforeSend.messages.map((message) => ({ ...message })),
        toolTimeline: stateBeforeSend.toolTimeline.map((event) => ({ ...event })),
        logEntries: stateBeforeSend.logEntries.map((entry) => ({ ...entry })),
        transcript: stateBeforeSend.transcript,
        sttMeta: { ...stateBeforeSend.sttMeta },
      };
      const handleVoiceStreamFailure = createStreamFailureHandler(
        voiceRollbackState,
        {
          setMessages,
          setToolTimeline,
          setLogEntries,
          setTranscript,
          stopStreaming,
          reportError: (message) => {
            toastError(message);
          },
          logError: (error) => {
            if (error instanceof Error) {
              console.error("Streaming error", error);
            } else if (error) {
              console.error("Streaming error", error);
            }
          },
        }
      );

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: "🎙️ Voice message sent.",
        createdAt: new Date(),
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
        streaming: true,
      };

      addMessage(userMessage);
      addMessage(assistantMessage);
      setIsStreaming(true);
      clearStreamData();

      const snapshot = useChatStore.getState();
      const payload = {
        audio_b64: audioB64,
        sample_rate: 16_000,
        messages: snapshot.getSessionHistory(),
        session_id: snapshot.sessionIdentifier,
        assistant_language: snapshot.assistantLanguage,
        enable_tools: snapshot.enableTools,
        model: snapshot.selectedModel,
        expect_audio: true,
        stream: true,
      };

      const controller = postEventStream<UnifiedChatStreamPayload>(
        "/v1/unified-chat",
        payload,
        {
          onEvent: async (event) => {
            const store = useChatStore.getState();
            if (event.event === "token") {
              const tokenText = getTokenText(event.data);
              if (tokenText) {
                const currentMsg = store.messages.find(
                  (message) => message.id === assistantMessage.id
                );
                if (currentMsg) {
                  store.updateMessage(assistantMessage.id, {
                    content: currentMsg.content + String(tokenText),
                    streaming: true,
                  });
                }
              }
            } else if (event.event === "tool") {
              const [eventData] = normalizeToolEvents([
                event.data as ChatToolEvent,
              ]);
              if (eventData) {
                store.addToolEvent(eventData);
              }
            } else if (event.event === "log") {
              const [logEntry] = normalizeLogEntries([event.data]);
              if (logEntry) {
                store.addLogEntry(logEntry);
              }
            } else if (event.event === "done") {
              const data = event.data as UnifiedChatStreamPayload;
              const currentMsg = store.messages.find(
                (message) => message.id === assistantMessage.id
              );
              store.updateMessage(assistantMessage.id, {
                content:
                  data.content ||
                  data.final_text ||
                  currentMsg?.content ||
                  "",
                streaming: false,
              });
              if (data.tool_events) {
                const normalized = normalizeToolEvents(data.tool_events);
                normalized.forEach(store.addToolEvent);
              }
              const normalizedLogs = normalizeLogEntries(data.logs);
              normalizedLogs.forEach(store.addLogEntry);
              store.setTranscript(data.transcript || null, {
                confidence: data.stt_confidence || undefined,
                language: data.stt_language || undefined,
              });
              playAudio(data.audio_b64);
              await finishStreaming();
            } else if (event.event === "error") {
              const eventMessage =
                typeof event.data === "string" && event.data
                  ? event.data
                  : "Streaming error";
              handleVoiceStreamFailure(eventMessage);
            }
          },
          onError: (error) => {
            handleVoiceStreamFailure(error.message || "Streaming failed.", error);
          },
        }
      );

      setStreamController(controller);
    } catch (error) {
      console.error("Voice recording failed", error);
      toastError("Unable to access microphone.");
      stopRecording();
    } finally {
      recordingStopResolverRef.current = null;
    }
  }, [
    addMessage,
    setMessages,
    setToolTimeline,
    setLogEntries,
    setTranscript,
    clearStreamData,
    finishStreaming,
    setIsStreaming,
    setStreamController,
    stopRecording,
    stopStreaming,
  ]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/settings");
    }
  }, [isAuthenticated, authLoading, router]);

  return {
    sessions,
    sessionsLoading,
    activeSession,
    sessionIdentifier,
    messages,
    input,
    isStreaming,
    streamController,
    toolTimeline,
    logEntries,
    transcript,
    sttMeta,
    isRecording,
    enableTools,
    expectAudio,
    assistantLanguage,
    selectedModel,
    health,
    healthLoading,
    setInput,
    setEnableTools,
    setExpectAudio,
    setAssistantLanguage,
    setSelectedModel,
    refreshSessions,
    fetchHealth,
    loadSessionMessages,
    handleSelectSession,
    handleDeleteSession,
    renameSession,
    stopStreaming,
    handleSendText,
    startRecording,
    stopRecording,
    startNewSession,
    deriveSessionName,
  };
}
