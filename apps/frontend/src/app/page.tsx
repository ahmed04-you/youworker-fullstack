"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Cpu,
  Loader2,
  LogOut,
  MessageCircle,
  Mic,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  StopCircle,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
  API_BASE_URL,
  ApiError,
  StreamController,
  postEventStream,
  apiDelete,
  apiGet,
  apiPatch,
} from "@/lib/api-client";
import {
  ChatLogEntry,
  ChatToolEvent,
  SessionDetail,
  SessionMessage,
  SessionSummary,
  UnifiedChatStreamPayload,
} from "@/lib/types";

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

const DEFAULT_MODEL = "gpt-oss:20b";
const DEFAULT_LANGUAGE = "en";
const MAX_HISTORY = 6_000;

function getTokenText(data: unknown) {
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object" && data !== null && "text" in data) {
    const value = (data as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  return "";
}

function normalizeToolEvents(source: unknown): ChatToolEvent[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const tool = typeof candidate.tool === "string" ? candidate.tool : undefined;
      const status = typeof candidate.status === "string" ? candidate.status : undefined;
      if (!tool || !status) {
        return null;
      }
      const normalized: ChatToolEvent = {
        tool,
        status,
      };
      if (candidate.latency_ms && typeof candidate.latency_ms === "number") {
        normalized.latency_ms = candidate.latency_ms;
      }
      if (candidate.result_preview && typeof candidate.result_preview === "string") {
        normalized.result_preview = candidate.result_preview;
      }
      if (candidate.ts && typeof candidate.ts === "string") {
        normalized.ts = candidate.ts;
      }
      if (candidate.args && typeof candidate.args === "object") {
        normalized.args = candidate.args as Record<string, unknown>;
      }
      return normalized;
    })
    .filter((entry): entry is ChatToolEvent => entry !== null);
}

function normalizeLogEntries(source: unknown): ChatLogEntry[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const value = item as Record<string, unknown>;
      const level = typeof value.level === "string" ? value.level : undefined;
      const msg = typeof value.msg === "string" ? value.msg : undefined;
      if (!level || !msg) {
        return null;
      }
      const normalized: ChatLogEntry = { level, msg };
      if (value.assistant_language && typeof value.assistant_language === "string") {
        normalized.assistant_language = value.assistant_language;
      }
      return normalized;
    })
    .filter((entry): entry is ChatLogEntry => entry !== null);
}

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

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [sessionIdentifier, setSessionIdentifier] = useState<string>(() => crypto.randomUUID());

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamController, setStreamController] = useState<StreamController | null>(null);

  const [toolTimeline, setToolTimeline] = useState<ChatToolEvent[]>([]);
  const [logEntries, setLogEntries] = useState<ChatLogEntry[]>([]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [sttMeta, setSttMeta] = useState<{ confidence?: number; language?: string }>({});

  const [enableTools, setEnableTools] = useState(true);
  const [expectAudio, setExpectAudio] = useState(false);
  const [assistantLanguage, setAssistantLanguage] = useState(DEFAULT_LANGUAGE);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStopResolver = useRef<(() => void) | null>(null);

  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const filteredSessionHistory = () =>
    messagesRef.current
      .filter((msg) => msg.role !== "system" && !msg.streaming)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
      .slice(-MAX_HISTORY);

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
      setHealth(data);
    } catch (error) {
      console.error("Health request failed", error);
    } finally {
      setHealthLoading(false);
    }
  }, []);

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
          sortedMessages.map((message) => ({
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

  const startNewSession = () => {
    const identifier = crypto.randomUUID();
    setActiveSession({
      id: -1,
      external_id: identifier,
      title: null,
      model: selectedModel,
      enable_tools: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSessionIdentifier(identifier);
    setMessages([]);
    setToolTimeline([]);
    setLogEntries([]);
    setTranscript(null);
  };

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
    setMessages((prev) =>
      prev.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg))
    );
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

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
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
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + String(tokenText) }
                    : msg
                )
              );
            }
          } else if (event.event === "tool") {
            const [eventData] = normalizeToolEvents([event.data as ChatToolEvent]);
            if (eventData) {
              setToolTimeline((prev) => [...prev, eventData].slice(-20));
            }
          } else if (event.event === "log") {
            const [logEntry] = normalizeLogEntries([event.data]);
            if (logEntry) {
              setLogEntries((prev) => [...prev, logEntry].slice(-40));
            }
          } else if (event.event === "done") {
            const data = event.data as UnifiedChatStreamPayload;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? {
                      ...msg,
                      content: data.content || data.final_text || msg.content,
                      streaming: false,
                    }
                  : msg
              )
            );
            if (data.tool_events) {
              const normalized = normalizeToolEvents(data.tool_events);
              if (normalized.length) {
                setToolTimeline((prev) => [...prev, ...normalized].slice(-50));
              }
            }
            const normalizedLogs = normalizeLogEntries(data.logs);
            if (normalizedLogs.length) {
              setLogEntries((prev) => [...prev, ...normalizedLogs].slice(-40));
            }
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

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
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
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + String(tokenText) }
                      : msg
                  )
                );
              }
            } else if (event.event === "tool") {
              const [eventData] = normalizeToolEvents([event.data as ChatToolEvent]);
              if (eventData) {
                setToolTimeline((prev) => [...prev, eventData].slice(-20));
              }
            } else if (event.event === "log") {
              const [logEntry] = normalizeLogEntries([event.data]);
              if (logEntry) {
                setLogEntries((prev) => [...prev, logEntry].slice(-40));
              }
            } else if (event.event === "done") {
              const data = event.data as UnifiedChatStreamPayload;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? {
                        ...msg,
                        content: data.content || data.final_text || msg.content,
                        streaming: false,
                      }
                    : msg
                )
              );
              if (data.tool_events) {
                const normalized = normalizeToolEvents(data.tool_events);
                if (normalized.length) {
                  setToolTimeline((prev) => [...prev, ...normalized].slice(-50));
                }
              }
              const normalizedLogs = normalizeLogEntries(data.logs);
              if (normalizedLogs.length) {
                setLogEntries((prev) => [...prev, ...normalizedLogs].slice(-40));
              }
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
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-3xl border border-border bg-card/70 px-8 py-12 text-center shadow-xl backdrop-blur">
          <h1 className="text-2xl font-semibold text-foreground">
            Redirecting to authenticate…
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-[320px] flex-col border-r border-border/60 bg-card/70 p-4 lg:flex">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
            <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={() => refreshSessions()}>
            {sessionsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <Button
          variant="secondary"
          className="mb-4 w-full gap-2 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={startNewSession}
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        <div className="flex-1 space-y-3 overflow-auto pr-2">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-6 text-center text-sm text-muted-foreground">
              No sessions yet. Start chatting to create your first conversation.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = activeSession?.id === session.id;
              return (
                <button
                  key={session.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-primary/60 bg-primary/10 shadow-sm"
                      : "border-transparent bg-background/60 hover:border-border/80 hover:bg-background"
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {deriveSessionName(session)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(session.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-primary/40 text-[10px] uppercase tracking-wide text-primary">
                      {session.model ? session.model.split(":")[0] : "auto"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                      <Sparkles className="h-3 w-3" />
                      {session.enable_tools ? "Tools" : "Chat"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRenameSession(session);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSession(session);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            Knowledge Hub
          </p>
          <p className="mt-1">
            Curate documents and tools that fuel the agent&apos;s reasoning.{" "}
            <Link href="/documents" className="text-primary underline">
              Visit documents →
            </Link>
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-card/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
          <section className="flex-1">
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
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                        <span className="font-medium">
                          {isUser ? "You" : isAssistant ? "YouWorker" : "System"}
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
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-card/80 p-5 shadow-xl backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span>Assistant language</span>
                    <Input
                      value={assistantLanguage}
                      onChange={(event) => setAssistantLanguage(event.target.value)}
                      className="h-7 w-16 rounded-full border-0 bg-transparent px-2 text-xs font-semibold uppercase text-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span>Model</span>
                    <Input
                      value={selectedModel}
                      onChange={(event) => setSelectedModel(event.target.value)}
                      className="h-7 w-[140px] rounded-full border-0 bg-transparent px-2 text-xs font-semibold text-foreground"
                    />
                  </div>
                  <Button
                    variant={enableTools ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setEnableTools((prev) => !prev)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {enableTools ? "Tools active" : "Enable tools"}
                  </Button>
                  <Button
                    variant={expectAudio ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setExpectAudio((prev) => !prev)}
                  >
                    <Volume2 className="mr-2 h-4 w-4" />
                    {expectAudio ? "Voice-on" : "Voice-off"}
                  </Button>
                </div>

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendText();
                    }
                  }}
                  placeholder="Ask anything… Request a plan, run a tool, or brainstorm in crimson style."
                  className="min-h-[110px] w-full rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-relaxed shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={`rounded-full ${isRecording ? "border-destructive text-destructive" : ""}`}
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                      disabled={isStreaming}
                    >
                      {isRecording ? (
                        <StopCircle className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                    <span>{isRecording ? "Recording… release to send." : "Hold to speak."}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStreaming && (
                      <Button variant="ghost" onClick={stopStreaming} className="rounded-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        Stop response
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSendText()}
                      disabled={!input.trim() || isStreaming}
                      className="rounded-full px-6"
                    >
                      {isStreaming ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Streaming…
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden w-[320px] space-y-5 xl:flex xl:flex-col">
            <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Tool timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {toolTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tools spring into action while you chat. You&apos;ll see them here in real time.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {toolTimeline.slice(-6).map((event, index) => (
                      <div
                        key={`${event.tool}-${event.status}-${index}`}
                        className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{event.tool}</span>
                          <Badge
                            className={`rounded-full text-[10px] uppercase tracking-wider ${
                              event.status === "start"
                                ? "bg-primary/10 text-primary"
                                : event.status === "success"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {event.status}
                          </Badge>
                        </div>
                        {event.latency_ms && (
                          <p className="mt-1 text-muted-foreground">
                            {event.latency_ms} ms •{" "}
                            {event.result_preview?.slice(0, 60)}
                            {event.result_preview && event.result_preview.length > 60 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                >
                  View analytics <ChevronRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Cpu className="h-4 w-4 text-primary" />
                  Reasoning trace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {logEntries.length === 0 ? (
                  <p className="text-muted-foreground">
                    We&apos;ll surface the thought process, warnings, and tool diagnostics here.
                  </p>
                ) : (
                  logEntries.slice(-8).map((log, index) => (
                    <div
                      key={`${log.level}-${index}`}
                      className="rounded-2xl border border-border/40 bg-background/60 px-3 py-2"
                    >
                      <span className="font-semibold uppercase tracking-wide text-primary">
                        {log.level}
                      </span>
                      <p className="mt-1 text-muted-foreground">{log.msg}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Voice capture
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transcript ? (
                  <div className="space-y-2 text-sm">
                    <p className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-foreground">
                      {transcript}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Confidence {(sttMeta.confidence ?? 0).toFixed(2)} •{" "}
                      {sttMeta.language?.toUpperCase() || "auto"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    When you speak to YouWorker we transcribe locally and surface the transcript
                    here.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  System health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {health ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`rounded-full text-[10px] uppercase tracking-wider ${
                          health.status === "healthy"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {health.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {health.components?.agent === "ready"
                          ? "Agent ready"
                          : "Agent warming up"}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2">
                      <p className="font-semibold text-foreground">Models</p>
                      <div className="mt-2 space-y-1">
                        {health.components?.ollama?.models &&
                          Object.entries(health.components.ollama.models).map(([key, model]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-muted-foreground"
                            >
                              <span>{model.name}</span>
                              <span
                                className={
                                  model.available
                                    ? "text-emerald-600"
                                    : "text-destructive font-medium"
                                }
                              >
                                {model.available ? "ready" : "missing"}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Health data will appear once the agent connects to the backend.
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
