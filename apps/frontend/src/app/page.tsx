"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  Cpu,
  Loader2,
  MessageCircle,
  Plus,
  Radio,
  Sparkles,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { ApiError, postEventStream, apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import { SessionSidebar } from "./_components/SessionSidebar";
import { ChatComposer } from "./_components/ChatComposer";
import { InsightSidebar } from "./_components/InsightSidebar";
import { MobileSessionDrawer } from "./_components/MobileSessionDrawer";
import {
  ChatLogEntry,
  ChatToolEvent,
  SessionDetail,
  SessionMessage,
  SessionSummary,
  UnifiedChatStreamPayload,
} from "@/lib/types";

import { getTokenText, normalizeToolEvents, normalizeLogEntries } from "@/lib/utils/normalize";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChatState } from "@/hooks/useChatState";

type Role = SessionMessage["role"];

interface ConversationMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: Date;
  streaming?: boolean;
  toolCallName?: string | null;
}

interface HealthStatus {
  status: string;
  components?: {
    ollama?: {
      ready: boolean;
      missing: string[];
      models: Record<
        string,
        {
          name: string;
          available: boolean;
        }
      >;
    };
    agent?: string;
    voice?: {
      stt_available: boolean;
      tts_available: boolean;
    };
  };
}

const MAX_HISTORY = 6_000;
const DEFAULT_MODEL = "gpt-oss:20b";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function deriveSessionName(session: SessionSummary | null) {
  if (!session) {
    return "New Conversation";
  }
  if (session.title) {
    return session.title;
  }
  if (session.external_id) {
    return session.external_id.slice(0, 8);
  }
  return `Session #${session.id}`;
}

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const chat = useChatState();
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
    messagesRef,
    audioContextRef,
    recordingStopResolver,
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
    updateMessagesRef,
  } = chat;

  const { scrollRef: messageListRef, hasNewMessages, scrollToBottom } = useAutoScroll<HTMLDivElement>({
    enabled: true,
    threshold: 100,
  });

  const filteredSessionHistory = useCallback(
    () =>
      messagesRef.current
        .filter((msg) => msg.role !== "system" && !msg.streaming)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
        .slice(-MAX_HISTORY),
    []
  );

  useEffect(() => {
    updateMessagesRef(messages);
  }, [messages, updateMessagesRef]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      void refreshSessions();
      void fetchHealth();
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/settings");
    }
  }, [isAuthenticated, authLoading, router]);


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
          void loadSessionMessages(response.sessions[0]);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Unavailable to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, [activeSession]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await apiGet<HealthStatus>("/health");
      setHealth(data, false);
    } catch (error) {
      console.error("Health request failed", error);
    } finally {
      setHealthLoading(false);
    }
  }, [setHealth, setHealthLoading]);

  const loadSessionMessages = useCallback(
    async (session: SessionSummary) => {
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
    },
    []
  );


  const handleSelectSession = async (session: SessionSummary) => {
    if (isStreaming) {
      toast.warning("Please wait for the current response to finish.");
      return;
    }
    setActiveSession(session);
    setSessionIdentifier(session.external_id || String(session.id));
    await loadSessionMessages(session);
  };

  const handleDeleteSession = async (session: SessionSummary) => {
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
  };

  const handleRenameSession = async (session: SessionSummary) => {
    if (session.id <= 0) return;
    const title = window.prompt("Rename conversation", session.title || "");
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
  };

  const stopStreaming = () => {
    streamController?.cancel();
    setStreamController(null);
    setIsStreaming(false);
    const streamingMsg = messages.find((msg) => msg.streaming);
    if (streamingMsg) {
      updateMessage(streamingMsg.id, streamingMsg.content, false);
    }
  };

  const playAudio = (audioB64: string | null | undefined) => {
    if (!audioB64) return;
    const audio = new Audio(`data:audio/wav;base64,${audioB64}`);
    audio.play().catch((error) => console.error("Audio playback failed", error));
  };

  const finishStreaming = useCallback(async () => {
    setIsStreaming(false);
    setStreamController(null);
    await refreshSessions();
  }, [refreshSessions]);

  const handleSendText = async () => {
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
    setTranscript(null);
    setToolTimeline([]);
    setLogEntries([]);
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
              const currentMsg = messagesRef.current.find(m => m.id === assistantMessage.id);
              if (currentMsg) {
                updateMessage(assistantMessage.id, currentMsg.content + String(tokenText), true);
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
            const currentMsg = messagesRef.current.find(m => m.id === assistantMessage.id);
            updateMessage(
              assistantMessage.id,
              data.content || data.final_text || currentMsg?.content || "",
              false
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
            playAudio(data.audio_b64);
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
  };

  const startRecording = async () => {
    if (isStreaming || isRecording) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
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
        recordingStopResolver.current = resolve;
        setTimeout(() => {
          stopRecording();
        }, 30_000);
      });

      const length = pcmData.reduce((acc, chunk) => acc + chunk.length, 0);
      const fullPcm = new Int16Array(length);
      let offset = 0;
      for (const chunk of pcmData) {
        fullPcm.set(chunk, offset);
        offset += chunk.length;
      }
      const pcmBytes = new Uint8Array(fullPcm.buffer);
      const audioB64 = btoa(String.fromCharCode(...pcmBytes));

      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: "🎙️ Voice message sent.",
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
      setIsStreaming(true);
      setToolTimeline([]);
      setLogEntries([]);

      const payload = {
        audio_b64: audioB64,
        sample_rate: 16000,
        messages: filteredSessionHistory(),
        session_id: sessionIdentifier,
        assistant_language: assistantLanguage,
        enable_tools: enableTools,
        model: selectedModel,
        expect_audio: true,
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
                const currentMsg = messagesRef.current.find(m => m.id === assistantMessage.id);
                if (currentMsg) {
                  updateMessage(assistantMessage.id, currentMsg.content + String(tokenText), true);
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
              const currentMsg = messagesRef.current.find(m => m.id === assistantMessage.id);
              updateMessage(
                assistantMessage.id,
                data.content || data.final_text || currentMsg?.content || "",
                false
              );
              if (data.tool_events) {
                const normalized = normalizeToolEvents(data.tool_events);
                normalized.forEach(addToolEvent);
              }
              const normalizedLogs = normalizeLogEntries(data.logs);
              normalizedLogs.forEach(addLogEntry);
              if (data.transcript) {
                setTranscript(data.transcript);
                setSttMeta({
                  confidence: data.stt_confidence || undefined,
                  language: data.stt_language || undefined,
                });
              }
              playAudio(data.audio_b64);
              await finishStreaming();
            }
          },
          onError: (error) => {
            console.error("Voice streaming error", error);
            toast.error("Voice request failed.");
            stopStreaming();
          },
        }
      );

      setStreamController(controller);
    } catch (error) {
      console.error("Recording error", error);
      toast.error("Unable to access microphone.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => undefined);
    }
    setIsRecording(false);
    recordingStopResolver.current?.();
    recordingStopResolver.current = null;
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/70 px-8 py-12 text-center shadow-xl backdrop-blur">
          <h1 className="text-2xl font-semibold text-foreground">
            Redirecting to authenticate…
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSession={activeSession}
        onRefresh={refreshSessions}
        onNewSession={startNewSession}
        onSelectSession={handleSelectSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-card/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MobileSessionDrawer
                sessions={sessions}
                sessionsLoading={sessionsLoading}
                activeSession={activeSession}
                onRefresh={refreshSessions}
                onNewSession={startNewSession}
                onSelectSession={handleSelectSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
              />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Active session
                </p>
                <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  {deriveSessionName(activeSession)}
                  <Badge variant="outline" className="rounded-full border-primary/40 text-[10px] uppercase tracking-wide text-primary">
                    {selectedModel.split(":")[0]}
                  </Badge>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Radio className={`h-3.5 w-3.5 ${isStreaming ? "animate-pulse" : ""}`} />
                {isStreaming ? "Streaming answer" : "Idle"}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                <Cpu className="h-3.5 w-3.5" />
                {enableTools ? "Tools enabled" : "Tools paused"}
              </div>
              <Button
                variant="outline"
                className="rounded-full border-primary/40 text-primary"
                onClick={() => fetchHealth()}
              >
                {healthLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Refresh system health
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-6 xl:flex-row">
          <section className="flex-1 relative">
            <div
              ref={messageListRef}
              className="flex h-[calc(100vh-320px)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Welcome to YouWorker.AI
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Start a conversation with crimson-fueled intelligence. Ask questions, request
                    research, orchestrate tool workflows, or ingest knowledge on the fly.
                  </p>
                  <div className="flex gap-2 text-sm">
                    <Button variant="secondary" className="rounded-full">
                      <Sparkles className="mr-2 h-4 w-4" /> Explore analytics
                    </Button>
                    <Button variant="ghost" className="rounded-full" onClick={() => startNewSession()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Start fresh
                    </Button>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  const isAssistant = message.role === "assistant";
                  const bubbleStyles = isUser
                    ? "ml-auto bg-primary text-primary-foreground shadow-lg"
                    : isAssistant
                      ? "mr-auto border border-border/70 bg-card/80 text-card-foreground shadow-sm"
                      : "mx-auto bg-secondary text-secondary-foreground";

                  return (
                    <div
                      key={message.id}
                      className={`flex max-w-3xl flex-col gap-2 rounded-3xl px-5 py-4 ${bubbleStyles}`}
                      data-testid="messages"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                        <span className="font-medium">
                          {isUser ? "You" : isAssistant ? "assistant" : "System"}
                        </span>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      {message.toolCallName && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="rounded-full bg-background/40">
                            Tool
                          </Badge>
                          <span>{message.toolCallName}</span>
                        </div>
                      )}
                      {message.streaming && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Streaming insight…
                        </div>
                      )}
                      {isAssistant && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground" data-testid="response">
                          assistant
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {hasNewMessages && (
              <Button
                onClick={() => scrollToBottom()}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
                size="sm"
              >
                <ArrowDown className="mr-2 h-4 w-4" />
                New messages
              </Button>
            )}

            <ChatComposer
              input={input}
              onInputChange={setInput}
              onSendText={handleSendText}
              isStreaming={isStreaming}
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onStopStreaming={stopStreaming}
              assistantLanguage={assistantLanguage}
              onAssistantLanguageChange={setAssistantLanguage}
              selectedModel={selectedModel}
              onSelectedModelChange={setSelectedModel}
              enableTools={enableTools}
              onToggleTools={() => setEnableTools(!enableTools)}
              expectAudio={expectAudio}
              onToggleAudio={() => setExpectAudio(!expectAudio)}
            />
          </section>

          <InsightSidebar
            toolTimeline={toolTimeline}
            logEntries={logEntries}
            transcript={transcript}
            sttMeta={sttMeta}
            health={health}
            healthLoading={healthLoading}
            onRefreshHealth={fetchHealth}
          />
        </div>
      </main>
    </div>
  );
}
