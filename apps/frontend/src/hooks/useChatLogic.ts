import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError, postEventStream, apiGet, apiDelete, apiPatch } from "@/lib/api-client";
import { SessionSummary, SessionDetail, SessionMessage, UnifiedChatStreamPayload, ChatToolEvent } from "@/lib/types";
import { getTokenText, normalizeToolEvents, normalizeLogEntries } from "@/lib/utils/normalize";
import { useChatStore } from "@/stores/chat-store";
import { ConversationMessage } from "@/stores/chat-store";

const MAX_HISTORY = 6000;
const DEFAULT_MODEL = "gpt-oss:20b";

export function useChatLogic() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
    enableTools,
    expectAudio,
    assistantLanguage,
    selectedModel,
    isRecording,
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
    clearStreamData,
    startNewSession,
    resetInsights,
  } = useChatStore();

  const filteredSessionHistory = useCallback(() => {
    return messages
      .filter((msg) => msg.role !== "system" && !msg.streaming)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
      .slice(-MAX_HISTORY);
  }, [messages]);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const response = await apiGet<{ sessions: SessionSummary[] }>("/v1/sessions", {
        query: { limit: 50 },
      });
      setSessions(response.sessions);

      if (response.sessions.length > 0) {
        if (
          activeSession &&
          response.sessions.some((session) => session.id === activeSession.id)
        ) {
          const updated = response.sessions.find((session) => session.id === activeSession.id);
          if (updated) {
            setActiveSession(updated);
            setSessionIdentifier(updated.external_id || String(updated.id));
          }
        } else if (!activeSession) {
          setActiveSession(response.sessions[0]);
          setSessionIdentifier(
            response.sessions[0].external_id || String(response.sessions[0].id)
          );
          loadSessionMessages(response.sessions[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Unavailable to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, [activeSession, setSessions, setSessionsLoading, setActiveSession, setSessionIdentifier]);

  const fetchHealth = useCallback(async () => {
    // Assuming health is added to store or handled separately
    // For now, placeholder
    console.log("Fetch health");
  }, []);

  const loadSessionMessages = useCallback(async (session: SessionSummary) => {
    if (!session || session.id <= 0) {
      setMessages([]);
      setToolTimeline([]);
      setLogEntries([]);
      return;
    }

    try {
      const detail = await apiGet<SessionDetail>(`/v1/sessions/${session.id}`);
      const sortedMessages = [...detail.session.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setEnableTools(detail.session.enable_tools);
      setSelectedModel(detail.session.model || DEFAULT_MODEL);
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
      toast.error("Unable to load session history.");
    }
  }, [setMessages, setEnableTools, setSelectedModel, setToolTimeline, setLogEntries, setTranscript]);

  const handleSelectSession = useCallback(async (session: SessionSummary) => {
    if (isStreaming) {
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    setActiveSession(session);
    setSessionIdentifier(session.external_id || String(session.id));
    await loadSessionMessages(session);
  }, [isStreaming, setActiveSession, setSessionIdentifier, loadSessionMessages]);

  const handleDeleteSession = useCallback(async (session: SessionSummary) => {
    if (session.id <= 0) return;
    try {
      await apiDelete(`/v1/sessions/${session.id}`);
      toast.success("Session deleted.");
      if (activeSession?.id === session.id) {
        startNewSession();
      }
      await refreshSessions();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete session.");
    }
  }, [activeSession, startNewSession, refreshSessions]);

  const handleRenameSession = useCallback(async (session: SessionSummary) => {
    if (session.id <= 0) return;
    const title = prompt("Rename conversation", session.title || "");
    if (title === null) return;
    try {
      await apiPatch(`/v1/sessions/${session.id}`, undefined, {
        query: { title },
      });
      toast.success("Session renamed.");
      await refreshSessions();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.error("Session not found.");
      } else {
        toast.error("Failed to rename session.");
      }
    }
  }, [refreshSessions]);

  const stopStreaming = useCallback(() => {
    streamController?.cancel();
    setStreamController(null);
    setIsStreaming(false);
    const streamingMsg = messages.find((msg) => msg.streaming);
    if (streamingMsg) {
      updateMessage(streamingMsg.id, { streaming: false });
    }
  }, [streamController, setStreamController, setIsStreaming, messages, updateMessage]);

  const finishStreaming = useCallback(async () => {
    setIsStreaming(false);
    setStreamController(null);
    await refreshSessions();
  }, [setIsStreaming, setStreamController, refreshSessions]);

  const handleSendText = useCallback(async () => {
    if (isStreaming) {
      toast.info("Hold on, still responding.");
      return;
    }
    if (!input.trim()) {
      return;
    }

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    };

    const assistantMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    };

    addMessage(userMessage);
    addMessage(assistantMessage);
    setInput("");
    resetInsights();
    setIsStreaming(true);

    const payload = {
      text_input: userMessage.content,
      messages: filteredSessionHistory(),
      session_id: sessionIdentifier,
      assistant_language: assistantLanguage,
      enable_tools: enableTools,
      model: selectedModel,
      expect_audio: expectAudio,
      stream: true,
    };

    const controller = postEventStream<UnifiedChatStreamPayload>(
      "/v1/unified-chat",
      payload,
      {
        onEvent: async (event) => {
          if (event.event === "token") {
            const tokenText = getTokenText(event.data);
            if (tokenText) {
              const currentMsg = messages.find(m => m.id === assistantMessage.id);
              if (currentMsg) {
                updateMessage(assistantMessage.id, { content: currentMsg.content + String(tokenText), streaming: true });
              }
            }
          } else if (event.event === "tool") {
            const [eventData] = normalizeToolEvents([event.data as ChatToolEvent]);
            if (eventData) {
              addToolEvent(eventData);
            }
          } else if (event.event === "log") {
            const [logEntry] = normalizeLogEntries([event.data]);
            if (logEntry) {
              addLogEntry(logEntry);
            }
          } else if (event.event === "done") {
            const data = event.data as UnifiedChatStreamPayload;
            const currentMsg = messages.find(m => m.id === assistantMessage.id);
            updateMessage(
              assistantMessage.id,
              { 
                content: data.content || data.final_text || currentMsg?.content || "",
                streaming: false
              }
            );
            if (data.tool_events) {
              const normalized = normalizeToolEvents(data.tool_events);
              normalized.forEach(addToolEvent);
            }
            const normalizedLogs = normalizeLogEntries(data.logs);
            normalizedLogs.forEach(addLogEntry);
            setTranscript(data.transcript || null);
            setSttMeta({
              confidence: data.stt_confidence || undefined,
              language: data.stt_language || undefined,
            });
            // playAudio(data.audio_b64); // Implement playAudio if needed
            await finishStreaming();
          } else if (event.event === "error") {
            toast.error("Streaming error");
          }
        },
        onError: (error) => {
          console.error("Streaming error", error);
          toast.error(error.message || "Streaming failed.");
          stopStreaming();
        },
      }
    );

    setStreamController(controller);
  }, [isStreaming, input, addMessage, setInput, resetInsights, setIsStreaming, filteredSessionHistory, sessionIdentifier, assistantLanguage, enableTools, selectedModel, expectAudio, messages, updateMessage, addToolEvent, addLogEntry, setTranscript, setSttMeta, finishStreaming, setStreamController, stopStreaming]);

  // Voice recording logic would be here, but for brevity, placeholder
  const startRecording = useCallback(() => {
    // Implement voice recording logic
    console.log("Start recording");
  }, []);

  const stopRecording = useCallback(() => {
    // Implement stop recording
    console.log("Stop recording");
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      refreshSessions();
      fetchHealth();
    }
  }, [isAuthenticated, authLoading, refreshSessions, fetchHealth]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/settings");
    }
  }, [isAuthenticated, authLoading, router]);

  return {
    sessions,
    sessionsLoading,
    activeSession,
    messages,
    input,
    isStreaming,
    isRecording,
    enableTools,
    expectAudio,
    assistantLanguage,
    selectedModel,
    toolTimeline,
    logEntries,
    transcript,
    sttMeta,
    refreshSessions,
    fetchHealth,
    loadSessionMessages,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    stopStreaming,
    handleSendText,
    startRecording,
    stopRecording,
    startNewSession,
  };
}
