"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ChatComposer from "../components/ChatComposer";
import MessageContent from "../components/MessageContent";
import { getSessions, getSession, deleteSession, sendChatStreaming, sendUnifiedChatStreaming, updateSession, createSession } from "../../lib/api/chat";
import type { ChatSession, Message, SSELogEvent, SSEDoneEvent, SSETokenEvent, SSEToolEvent, ToolEvent } from "../../lib/types";

type ToolRunStatus = "running" | "success" | "error";

interface ToolRunDisplay {
  id: string;
  tool: string;
  status: ToolRunStatus;
  latencyMs?: number;
  runId?: number;
  startedAt?: number;
  error?: string;
}

function normalizeToolStatus(rawStatus?: string): ToolRunStatus {
  const status = (rawStatus || "").toLowerCase();
  if (status === "start" || status === "running" || status === "") {
    return "running";
  }
  if (
    status === "end" ||
    status === "success" ||
    status === "completed" ||
    status === "done" ||
    status === "complete" ||
    status === "finished" ||
    status === "ok"
  ) {
    return "success";
  }
  return "error";
}

function formatLatency(latencyMs?: number): string | undefined {
  if (latencyMs === undefined || latencyMs === null) {
    return undefined;
  }
  if (latencyMs < 1000) {
    return `${latencyMs} ms`;
  }
  const seconds = latencyMs / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
}

function integrateToolEvent(
  previous: ToolRunDisplay[],
  event: ToolEvent,
  now: number
): ToolRunDisplay[] {
  const toolName = event.tool || "Unknown Tool";
  const runId = typeof event.run_id === "number" ? event.run_id : undefined;
  const status = normalizeToolStatus(event.status);
  const identifier = runId !== undefined ? `run-${runId}` : `${toolName}-${status}-${now}`;

  const existingIndex = previous.findIndex((entry) =>
    runId !== undefined ? entry.runId === runId : entry.tool === toolName && entry.status === "running"
  );

  const updated = [...previous];

  if (existingIndex === -1) {
    updated.push({
      id: identifier,
      tool: toolName,
      status,
      runId,
      startedAt: status === "running" ? now : undefined,
      latencyMs: status === "success" ? event.latency_ms ?? undefined : undefined,
      error: status === "error" ? (event.error as string | undefined) : undefined,
    });
    return updated;
  }

  const existing = updated[existingIndex];
  const startedAt = existing.startedAt ?? (status === "running" ? now : undefined);
  let latency = existing.latencyMs;
  if (status !== "running") {
    const computedLatency = startedAt ? Math.max(0, now - startedAt) : undefined;
    latency = event.latency_ms ?? latency ?? computedLatency;
  }

  updated[existingIndex] = {
    ...existing,
    status,
    latencyMs: latency,
    runId: runId ?? existing.runId,
    startedAt,
    error: status === "error" ? (event.error as string | undefined) : undefined,
  };

  return updated;
}

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  activeMenu: number | null;
  onSessionClick: () => void;
  onEditTitleChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onMenuToggle: (e: React.MouseEvent) => void;
  actionButtonRef: (el: HTMLButtonElement | null) => void;
}

const SessionItem = memo(function SessionItem({
  session,
  isActive,
  isEditing,
  editingTitle,
  activeMenu,
  onSessionClick,
  onEditTitleChange,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onMenuToggle,
  actionButtonRef,
}: SessionItemProps) {
  return (
    <div
      className={`chat-history-item ${isActive ? "active" : ""}`}
      onClick={onSessionClick}
    >
      {isEditing ? (
        <div className="edit-session-form" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={onEditKeyDown}
            className="edit-session-input"
            autoFocus
          />
          <button className="save-btn" onClick={onSaveEdit}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button className="cancel-btn" onClick={onCancelEdit}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <span className="chat-title">{session.title || "New Chat"}</span>
          <div className="chat-actions">
            <button
              ref={actionButtonRef}
              className="actions-btn"
              onClick={onMenuToggle}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default function Chats() {
  const { isAuthenticated, isLoading: authLoading, csrfToken, reauthenticate } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeSessionExternalId, setActiveSessionExternalId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showChatDetail, setShowChatDetail] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [toolEvents, setToolEvents] = useState<ToolRunDisplay[]>([]);
  const [hasToolEvents, setHasToolEvents] = useState(false);
  const [expectAudio, setExpectAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<string>("");
  const sessionInitializedRef = useRef<boolean>(false);

  const updateStreamingContent = (updater: string | ((prev: string) => string)) => {
    setStreamingContent((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      streamingContentRef.current = next;
      return next;
    });
  };

  const setToolEventsFromList = useCallback(
    (events?: Array<SSEToolEvent | ToolEvent>, shouldMerge: boolean = false) => {
      if (!events || events.length === 0) {
        if (!shouldMerge) {
          setToolEvents([]);
          setHasToolEvents(false);
        }
        return;
      }

      setToolEvents((prev) => {
        const base = shouldMerge ? [...prev] : [];
        const next = events.reduce(
          (acc, event) => integrateToolEvent(acc, event, Date.now()),
          base
        );
        setHasToolEvents(next.length > 0);
        return next;
      });
    },
    []
  );

  const addToolEvent = (event?: SSEToolEvent | ToolEvent) => {
    if (!event || typeof event !== "object") {
      return;
    }

    setToolEvents((prev) => {
      const next = integrateToolEvent([...prev], event, Date.now());
      setHasToolEvents(next.length > 0);
      return next;
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, streamingStatus]);

  // Debug: Log state changes
  useEffect(() => {
    console.log("State updated - messages length:", messages.length, "activeSessionId:", activeSessionId);
  }, [messages, activeSessionId]);

  // Update menu position
  useEffect(() => {
    if (activeMenu !== null && actionButtonRefs.current[activeMenu]) {
      const button = actionButtonRefs.current[activeMenu];
      if (button) {
        const rect = button.getBoundingClientRect();
        const menuHeight = 88;
        const viewportHeight = window.innerHeight;
        const wouldOverflow = rect.bottom + menuHeight > viewportHeight;

        setMenuPosition({
          top: wouldOverflow ? rect.top - menuHeight + 6 : rect.bottom - 6,
          left: rect.right - 110,
        });
      }
    }
  }, [activeMenu, isDrawerOpen]);

  // Close actions menu when clicking outside
  useEffect(() => {
    if (activeMenu === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on the action button itself
      const activeButton = actionButtonRefs.current[activeMenu];
      if (activeButton && activeButton.contains(target)) {
        return;
      }

      // Don't close if clicking inside the menu
      if (actionsMenuRef.current && actionsMenuRef.current.contains(target)) {
        return;
      }

      // Close the menu
      setActiveMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenu]);

  const loadSessions = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 1;

    try {
      setIsLoadingSessions(true);
      setError(null);
      const response = await getSessions();
      const sessionList = response.sessions || [];
      setSessions(sessionList);

      if (sessionList.length === 0) {
        setActiveSessionExternalId(null);
      }

      // Auto-select first session if none selected
      if (sessionList.length > 0 && activeSessionId === null && activeSessionExternalId === null) {
        const firstSession = sessionList[0];
        setActiveSessionId(firstSession.id);
        setActiveSessionExternalId(firstSession.external_id ?? null);
      } else if (activeSessionId !== null) {
        const matchedSession = sessionList.find((session) => session.id === activeSessionId);
        if (matchedSession) {
          setActiveSessionExternalId(matchedSession.external_id ?? activeSessionExternalId);
        }
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);

      // Check if it's an authentication error
      const is401Error = err instanceof Error &&
        (err.message.includes('401') || err.message.includes('Not authenticated'));

      if (is401Error && retryCount < MAX_RETRIES) {
        try {
          console.log('Session load failed due to auth, re-authenticating...');
          await reauthenticate();
          await new Promise(resolve => setTimeout(resolve, 300));
          return loadSessions(retryCount + 1);
        } catch (reauthErr) {
          console.error("Re-authentication failed during session load:", reauthErr);
          setError("Failed to load sessions. Please refresh the page.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      }
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeSessionExternalId, activeSessionId, reauthenticate]);

  const loadMessages = useCallback(async (sessionId: number, retryCount = 0) => {
    const MAX_RETRIES = 1;

    try {
      setIsLoadingMessages(true);
      setError(null);
      const response = await getSession(sessionId);
      setMessages(response.messages || []);
      setToolEventsFromList(response.tool_events);

      const externalId = response.session?.external_id ?? null;
      if (externalId !== null) {
        setActiveSessionExternalId(externalId);
      }

      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Failed to load messages:", err);

      // Check if it's an authentication error
      const is401Error = err instanceof Error &&
        (err.message.includes('401') || err.message.includes('Not authenticated'));

      if (is401Error && retryCount < MAX_RETRIES) {
        try {
          console.log('Message load failed due to auth, re-authenticating...');
          await reauthenticate();
          await new Promise(resolve => setTimeout(resolve, 300));
          return loadMessages(sessionId, retryCount + 1);
        } catch (reauthErr) {
          console.error("Re-authentication failed during message load:", reauthErr);
          setError("Failed to load messages. Please refresh the page.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [reauthenticate, setToolEventsFromList]);

  // Load sessions on mount
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadSessions();
    }
  }, [authLoading, isAuthenticated, loadSessions]);

  // Request new session on mount if no active session
  useEffect(() => {
    const initializeSession = async () => {
      // Only initialize once per page load
      if (sessionInitializedRef.current) {
        return;
      }

      if (isAuthenticated && !authLoading && !activeSessionExternalId && csrfToken) {
        sessionInitializedRef.current = true;
        try {
          const { external_id } = await createSession(csrfToken);
          setActiveSessionExternalId(external_id);
          console.log("New session initialized on mount:", external_id);
        } catch (err) {
          console.error("Failed to create session on mount:", err);
          // Reset flag on error so it can retry
          sessionInitializedRef.current = false;
        }
      }
    };

    initializeSession();
  }, [isAuthenticated, authLoading, activeSessionExternalId, csrfToken]);

  // Load messages when active session changes
  useEffect(() => {
    console.log("activeSessionId changed to:", activeSessionId);

    if (activeSessionId !== null) {
      console.log("Loading messages for session:", activeSessionId);
      loadMessages(activeSessionId);
    } else {
      console.log("activeSessionId is null, not loading messages");
    }
  }, [activeSessionId, loadMessages]);

  const handleSendMessage = async (content: string, retryCount = 0) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const MAX_RETRIES = 1;
    const newUserMessage: Message = {
      role: "user",
      content: trimmed,
    };
    const conversation: Message[] =
      retryCount === 0 ? [...messages, newUserMessage] : [...messages];

    // Capture the session context at the start of this request
    // We'll use this to check if the session changed while streaming
    const requestSessionId = activeSessionId;
    const requestSessionExternalId = activeSessionExternalId;

    console.log("Sending message with session context:", {
      requestSessionId,
      requestSessionExternalId,
      activeSessionId,
      activeSessionExternalId
    });

    try {
      setIsSending(true);
      setError(null);
      updateStreamingContent("");
      setStreamingStatus("Thinking...");

      // Add user message optimistically (only on first attempt)
      if (retryCount === 0) {
        setMessages((prev) => [...prev, newUserMessage]);
      }

      // Send message via streaming API
      await sendChatStreaming(
        {
          message: trimmed,
          messages: conversation,
          session_id: requestSessionExternalId || undefined,
          enable_tools: true,
          expect_audio: expectAudio,
        },
        {
          onLog: (log: SSELogEvent) => {
            console.log(`[${log.level}]`, log.msg);
            // Update streaming status with info messages
            if (log.level === 'info' && log.msg) {
              setStreamingStatus(log.msg);
            }
          },
          onToken: (token: SSETokenEvent) => {
            if (token?.text) {
              updateStreamingContent((prev) => prev + token.text);
            }
          },
          onTool: (event: SSEToolEvent) => {
            addToolEvent(event);
          },
          onDone: (response: SSEDoneEvent) => {
            console.log("onDone received:", {
              requestSessionId,
              activeSessionId,
              metadata: response.metadata
            });

            // Check if the session context has changed during streaming
            // If user clicked "New Chat" or switched sessions, don't update
            const sessionStillActive =
              (requestSessionId === null && activeSessionId === null) || // Still in new session
              (requestSessionId !== null && requestSessionId === activeSessionId); // Still in same session

            if (!sessionStillActive) {
              console.log("Session context changed during streaming, ignoring response");
              return;
            }

            const finalContent = (response.content || streamingContentRef.current).trim();
            if (finalContent) {
              const assistantMessage: Message = {
                role: "assistant",
                content: finalContent,
              };
              setMessages((prev) => [...prev, assistantMessage]);
            }

            // Don't merge tool events from done event - they were already added during streaming
            // The tool_events in the done event are just a summary of what was already streamed

            const metadata = response.metadata || {};
            const sessionIdMeta = metadata.session_id ?? metadata.sessionId;
            const sessionExternalMeta = metadata.session_external_id ?? metadata.sessionExternalId;

            console.log("Setting session IDs from metadata:", {
              sessionIdMeta,
              sessionExternalMeta
            });

            if (sessionIdMeta !== undefined && sessionIdMeta !== null) {
              const numericId = Number(sessionIdMeta);
              if (!Number.isNaN(numericId)) {
                setActiveSessionId(numericId);
              }
            }

            if (sessionExternalMeta) {
              setActiveSessionExternalId(String(sessionExternalMeta));
            }

            // Update session ID if this was a new conversation
            void loadSessions(); // Refresh sessions list

            updateStreamingContent("");
            setStreamingStatus("");
          },
          onError: (error: Error) => {
            console.error("Streaming error:", error);

            // Check if it's a 401 error
            if (error.message.includes('401') || error.message.includes('Not authenticated')) {
              setStreamingStatus("Session expired, re-authenticating...");
              // Don't set error here, let the catch block handle it
              throw error;
            } else {
              setError(error.message);
            }
          },
          onComplete: () => {
            setIsSending(false);
            updateStreamingContent("");
            setStreamingStatus("");
          },
        },
        csrfToken || undefined
      );
    } catch (err) {
      console.error("Failed to send message:", err);

      // Check if it's an authentication error and we haven't exceeded retry limit
      const is401Error = err instanceof Error &&
        (err.message.includes('401') || err.message.includes('Not authenticated'));

      if (is401Error && retryCount < MAX_RETRIES) {
        try {
          console.log(`Authentication failed, attempting to re-authenticate (retry ${retryCount + 1}/${MAX_RETRIES})...`);
          setStreamingStatus("Re-authenticating...");

          // Re-authenticate
          await reauthenticate();

          // Retry the request
          setStreamingStatus("Retrying...");
          setIsSending(false);
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
          return handleSendMessage(content, retryCount + 1);
        } catch (reauthErr) {
          console.error("Re-authentication failed:", reauthErr);
          setError("Session expired and re-authentication failed. Please refresh the page.");
          setIsSending(false);
          updateStreamingContent("");
          setStreamingStatus("");

          // Remove the optimistically added user message
          if (retryCount === 0) {
            setMessages((prev) => prev.slice(0, -1));
          }
        }
      } else {
        // Not a 401 error or exceeded retries
        const errorMessage = err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        setIsSending(false);
        updateStreamingContent("");
        setStreamingStatus("");

        // Remove the optimistically added user message on final failure
        if (retryCount === 0) {
          setMessages((prev) => prev.slice(0, -1));
        }
      }
    }
  };

  const handleAudioSend = async (audioBlob: Blob, shouldExpectAudio: boolean) => {
    // Show transcribing state
    setIsTranscribing(true);
    setIsSending(true);
    setError(null);

    // Add a placeholder message for transcribing
    const transcribingMessage: Message = {
      role: "user",
      content: "Transcribing...",
    };
    setMessages((prev) => [...prev, transcribingMessage]);

    try {
      // Convert Blob to base64
      const reader = new FileReader();
      const audioB64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Capture session context
      const requestSessionId = activeSessionId;
      const requestSessionExternalId = activeSessionExternalId;

      let transcriptedText = "";

      // Send to backend via unified chat endpoint
      const conversation: Message[] = [...messages];
      await sendUnifiedChatStreaming(
        {
          audio_b64: audioB64,
          sample_rate: 48000, // WebM audio is usually 48kHz
          messages: conversation.map(m => ({ role: m.role, content: m.content })),
          session_id: requestSessionExternalId || undefined,
          enable_tools: true,
          expect_audio: shouldExpectAudio,
          stream: true,
        },
        {
          onLog: (log: SSELogEvent) => {
            console.log(`[${log.level}]`, log.msg);
            if (log.level === 'info' && log.msg) {
              setStreamingStatus(log.msg);
            }
          },
          onToken: (token: SSETokenEvent) => {
            // First token means transcription has started
            if (isTranscribing) {
              setIsTranscribing(false);
            }
            if (token?.text) {
              transcriptedText += token.text;
              updateStreamingContent((prev) => prev + token.text);
            }
          },
          onTool: (event: SSEToolEvent) => {
            addToolEvent(event);
          },
          onDone: (response: SSEDoneEvent) => {
            const sessionStillActive =
              (requestSessionId === null && activeSessionId === null) ||
              (requestSessionId !== null && requestSessionId === activeSessionId);

            if (!sessionStillActive) {
              console.log("Session context changed during streaming, ignoring response");
              return;
            }

            // Replace transcribing message with actual transcription
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (updated[lastIndex]?.content === "Transcribing...") {
                updated[lastIndex] = {
                  role: "user",
                  content: response.transcript || transcriptedText || "...",
                };
              }
              return updated;
            });

            const finalText = streamingContentRef.current || response.content || "";

            if (finalText.trim()) {
              const assistantMessage: Message = {
                role: "assistant",
                content: finalText,
              };
              setMessages((prev) => [...prev, assistantMessage]);
            }

            // Handle audio response if present
            if (response.audio_b64 && response.audio_sample_rate) {
              try {
                // Decode base64 to binary
                const binaryString = atob(response.audio_b64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                // Create audio blob and play
                const blob = new Blob([bytes], { type: "audio/wav" });
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);

                audio.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                };

                audio.onerror = (error) => {
                  console.error("Audio playback error:", error);
                  URL.revokeObjectURL(audioUrl);
                };

                audio.play().catch((error) => {
                  console.error("Failed to play TTS audio:", error);
                  URL.revokeObjectURL(audioUrl);
                });
              } catch (error) {
                console.error("Failed to decode TTS audio:", error);
              }
            }

            updateStreamingContent("");
            setStreamingStatus("");
            setIsSending(false);
            setIsTranscribing(false);

            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

            if (response.metadata) {
              const newSessionId = response.metadata.session_id as number | undefined;
              const newSessionExternalId = response.metadata.session_external_id as string | undefined;

              if (newSessionId && !requestSessionId) {
                setActiveSessionId(newSessionId);
                void loadSessions();
              }
              if (newSessionExternalId && !requestSessionExternalId) {
                setActiveSessionExternalId(newSessionExternalId);
              }
            }
          },
          onError: (err: Error) => {
            console.error("Error during audio transcription:", err);
            setError(err.message);
            setIsSending(false);
            setIsTranscribing(false);
            updateStreamingContent("");
            setStreamingStatus("");

            // Remove transcribing message on error
            setMessages((prev) => prev.filter((m) => m.content !== "Transcribing..."));
          },
          onComplete: () => {
            // Audio transcription streaming complete
          },
        },
        csrfToken || undefined
      );
    } catch (err) {
      console.error("Failed to process audio:", err);
      setError(err instanceof Error ? err.message : "Failed to process audio");
      setIsSending(false);
      setIsTranscribing(false);

      // Remove transcribing message on error
      setMessages((prev) => prev.filter((m) => m.content !== "Transcribing..."));
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await deleteSession(sessionId, csrfToken || undefined);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setActiveSessionExternalId(null);
        setMessages([]);
        setToolEvents([]);
        setHasToolEvents(false);
      }

      setActiveMenu(null);
      void loadSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  };

  const handleNewChat = async () => {
    console.log("handleNewChat called - requesting new session");

    try {
      // Request new session from backend
      const { external_id } = await createSession(csrfToken || undefined);
      console.log("New session created:", external_id);

      // Clear all session state and set new session ID
      setActiveSessionId(null);
      setActiveSessionExternalId(external_id);
      setMessages([]);
      setToolEvents([]);
      setHasToolEvents(false);
      setStreamingContent("");
      setStreamingStatus("");
      setError(null);
      setIsLoadingMessages(false);
      setIsSending(false);
      setIsDrawerOpen(false);

      // Scroll to top of messages container to show the centered composer
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0;
          console.log("Scrolled to top");
        }
      }, 0);
    } catch (err) {
      console.error("Failed to create new session:", err);
      setError(err instanceof Error ? err.message : "Failed to create new session");
    }
  };

  const handleEditSession = (sessionId: number, currentTitle: string | null) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle || "");
    setActiveMenu(null);
  };

  const handleSaveEdit = async () => {
    if (editingSessionId === null) return;

    try {
      await updateSession(editingSessionId, { title: editingTitle }, csrfToken || undefined);
      // Update local state since backend only returns {success: true}
      setSessions((prev) => prev.map((s) =>
        s.id === editingSessionId ? { ...s, title: editingTitle } : s
      ));
      setEditingSessionId(null);
      setEditingTitle("");
    } catch (err) {
      console.error("Failed to update session:", err);
      setError(err instanceof Error ? err.message : "Failed to update session");
    }
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // Memoized session item callbacks
  const handleSessionClick = useCallback((sessionId: number, externalId: string | null) => {
    setActiveSessionId(sessionId);
    setActiveSessionExternalId(externalId);
    setIsDrawerOpen(false);
  }, []);

  const handleMenuToggle = useCallback((sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === sessionId ? null : sessionId);
  }, [activeMenu]);

  const handleEditTitleChange = useCallback((value: string) => {
    setEditingTitle(value);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  }, []);

  // Show loading state while authenticating
  if (authLoading) {
    return (
      <div className="chats-page">
        <div className="chat-list-card">
          <div className="loading-state">Authenticating...</div>
        </div>
      </div>
    );
  }

  // Show error if authentication failed
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="chats-page">
        <div className="chat-list-card">
          <div className="banner banner-error">
            Authentication failed. Please check your configuration and try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chats-page">
      <div className="chat-list-card">
        {isDrawerOpen && (
          <div
            className="drawer-blur-overlay"
            onClick={() => {
              setIsDrawerOpen(false);
              setActiveMenu(null);
            }}
          />
        )}
        {activeMenu !== null && (
          <div
            className="menu-overlay"
            onClick={() => setActiveMenu(null)}
          />
        )}
        {activeMenu !== null && (
          <div
            ref={actionsMenuRef}
            className="actions-menu"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button
              className="menu-item"
              onClick={() => {
                const session = sessions.find(s => s.id === activeMenu);
                if (session) {
                  handleEditSession(session.id, session.title);
                }
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              className="menu-item delete"
              onClick={() => {
                if (activeMenu !== null) {
                  handleDeleteSession(activeMenu);
                }
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}

        <button
          className={`drawer-toggle ${isDrawerOpen ? "open" : ""}`}
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          <svg className="drawer-icon" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 3.5 L10.5 20.5 L7 20.5 C4.79 20.5 3.5 19.21 3.5 17 L3.5 7 C3.5 4.79 4.79 3.5 7 3.5 Z" fill="currentColor"/>
            <path className="drawer-arrow" d="M14.5 9.5 L17 12 L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div
          className={`chat-drawer ${isDrawerOpen ? "open" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveMenu(null);
            }
          }}
        >
          <button className="new-chat-btn" onClick={(e) => {
            e.stopPropagation();
            handleNewChat();
          }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>

          <div className="drawer-separator"></div>

          <div
            className="chat-history"
            onScroll={() => setActiveMenu(null)}
          >
            {isLoadingSessions ? (
              <div className="loading-state">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="empty-state">No chat sessions yet</div>
            ) : (
              sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  isEditing={editingSessionId === session.id}
                  editingTitle={editingTitle}
                  activeMenu={activeMenu}
                  onSessionClick={() => handleSessionClick(session.id, session.external_id ?? null)}
                  onEditTitleChange={handleEditTitleChange}
                  onEditKeyDown={handleEditKeyDown}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onMenuToggle={(e) => handleMenuToggle(session.id, e)}
                  actionButtonRef={(el) => { actionButtonRefs.current[session.id] = el; }}
                />
              ))
            )}
          </div>
        </div>

        <div className="chat-session-container">
          <div className="chat-messages-wrapper">
            {showChatDetail && (
              <div className="chat-messages" ref={messagesContainerRef}>
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                {isLoadingMessages ? (
                  <div className="loading-state">Loading messages...</div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <div key={index} className={`message-wrapper ${message.role}`}>
                        <div className="message-avatar">
                          {message.role === "user" ? (
                            <svg className="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          ) : (
                            <svg className="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                          )}
                        </div>
                        <div className="message-content">
                          {message.content === "Transcribing..." ? (
                            <div className="transcribing-indicator">
                              <svg className="transcribing-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <span>Transcribing...</span>
                            </div>
                          ) : (
                            <MessageContent content={message.content} isStreaming={false} />
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Show streaming content while assistant is responding */}
                    {streamingContent && (
                      <div className="message-wrapper assistant streaming">
                        <div className="message-avatar">
                          <svg className="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                        </div>
                        <div className="message-content">
                          <MessageContent content={streamingContent} isStreaming={true} />
                          <div className="typing-cursor"></div>
                        </div>
                      </div>
                    )}

                    {/* Show typing indicator with status */}
                    {isSending && !streamingContent && (
                      <div className="message-wrapper assistant thinking">
                        <div className="message-avatar">
                          <svg className="avatar-icon animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                        </div>
                        <div className="message-content">
                          <div className="thinking-container">
                            {streamingStatus && (
                              <div className="thinking-status">{streamingStatus}</div>
                            )}
                            <div className="typing-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <ChatComposer
            onFirstSend={() => setShowChatDetail(true)}
            onSend={handleSendMessage}
            onAudioSend={handleAudioSend}
            isLoading={isSending}
            scrollContainerRef={messagesContainerRef}
            hasMessages={messages.length > 0}
            expectAudio={expectAudio}
            onExpectAudioChange={setExpectAudio}
          />
        </div>
      </div>

      {showChatDetail && hasToolEvents && (
        <div className="chat-detail-card">
          {isDrawerOpen && (
            <div
              className="drawer-blur-overlay"
              onClick={() => {
                setIsDrawerOpen(false);
                setActiveMenu(null);
              }}
            />
          )}
          <div className="tools-panel">
            <h3 className="tools-title">Tools Used</h3>
            <div className="tools-list">
              {toolEvents.map((event) => {
                const toolName = event.tool || "Unknown Tool";
                const isRunning = event.status === "running";
                const statusLabel =
                  event.status === "error"
                    ? "Failed"
                    : isRunning
                      ? "Running"
                      : "Completed";
                const latencyLabel = !isRunning ? formatLatency(event.latencyMs) : undefined;

                return (
                  <div key={event.id} className={`tool-card ${isRunning ? "tool-card-running" : ""}`}>
                    <div className="tool-icon">
                      {toolName.toLowerCase().includes("search") ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      ) : toolName.toLowerCase().includes("fetch") || toolName.toLowerCase().includes("web") ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      ) : toolName.toLowerCase().includes("time") || toolName.toLowerCase().includes("date") ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : toolName.toLowerCase().includes("document") || toolName.toLowerCase().includes("file") ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="tool-info">
                      <div className="tool-name">{toolName}</div>
                      <div className="tool-status-row">
                        {isRunning ? (
                          <span className="tool-status-spinner" aria-hidden="true" />
                        ) : (
                          <span className={`tool-status-dot status-${event.status}`} aria-hidden="true" />
                        )}
                        <span className="tool-status-text">
                          {isRunning ? "Running…" : statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="tool-meta">
                      {isRunning ? (
                        <span className="tool-meta-text">Processing…</span>
                      ) : latencyLabel ? (
                        <>
                          <span className="tool-latency">{latencyLabel}</span>
                          <span className="tool-meta-subtext">Latency</span>
                        </>
                      ) : (
                        <span className="tool-meta-text">{statusLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
