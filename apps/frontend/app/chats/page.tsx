"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ChatComposer from "../components/ChatComposer";
import AuthPrompt from "../components/AuthPrompt";
import { getSessions, getSession, deleteSession, sendChatStreaming } from "../../lib/api/chat";
import type { ChatSession, Message, SSELogEvent, SSEDoneEvent, SSETokenEvent, SSEToolEvent, ToolEvent } from "../../lib/types";

export default function Chats() {
  const { isAuthenticated, isLoading: authLoading, csrfToken, reauthenticate } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
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
  const [toolEvents, setToolEvents] = useState<{ [key: string]: number }>({});
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<string>("");

  const updateStreamingContent = (updater: string | ((prev: string) => string)) => {
    setStreamingContent((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      streamingContentRef.current = next;
      return next;
    });
  };

  const buildToolCounts = (events?: Array<SSEToolEvent | ToolEvent>) => {
    const counts: { [key: string]: number } = {};
    if (!events) {
      return counts;
    }

    events.forEach((event) => {
      if (!event || typeof event !== "object") {
        return;
      }

      const toolName = (event as SSEToolEvent).tool || (event as ToolEvent).tool || (event as any).name;
      if (!toolName) {
        return;
      }

      const normalized = String(toolName).trim();
      if (!normalized) {
        return;
      }
      counts[normalized] = (counts[normalized] || 0) + 1;
    });

    return counts;
  };

  const setToolCountsFromEvents = (events?: Array<SSEToolEvent | ToolEvent>) => {
    setToolEvents(buildToolCounts(events));
  };

  const incrementToolCount = (toolName?: string) => {
    if (!toolName) {
      return;
    }

    setToolEvents((prev) => {
      const next = { ...prev };
      const normalized = toolName.trim();
      if (!normalized) {
        return next;
      }
      next[normalized] = (next[normalized] || 0) + 1;
      return next;
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, streamingStatus]);

  // Load sessions on mount
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadSessions();
    }
  }, [isAuthenticated, authLoading]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSessionId !== null) {
      loadMessages(activeSessionId);
    }
  }, [activeSessionId]);

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

  const loadSessions = async (retryCount = 0) => {
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
  };

  const loadMessages = async (sessionId: number, retryCount = 0) => {
    const MAX_RETRIES = 1;

    try {
      setIsLoadingMessages(true);
      setError(null);
      const response = await getSession(sessionId);
      setMessages(response.messages || []);
      setToolCountsFromEvents(response.tool_events);

      const externalId = response.session?.external_id ?? null;
      if (externalId !== null) {
        setActiveSessionExternalId(externalId);
      }
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
  };

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
          session_id: activeSessionExternalId || undefined,
          enable_tools: true,
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
            incrementToolCount(event?.tool || (event as any)?.name);
          },
          onDone: (response: SSEDoneEvent) => {
            const finalContent = (response.content || streamingContentRef.current).trim();
            if (finalContent) {
              const assistantMessage: Message = {
                role: "assistant",
                content: finalContent,
              };
              setMessages((prev) => [...prev, assistantMessage]);
            }

            // Refresh tool usage counts from backend payload
            if (response.tool_events && response.tool_events.length > 0) {
              setToolCountsFromEvents(response.tool_events);
            }

            const metadata = response.metadata || {};
            const sessionIdMeta = metadata.session_id ?? metadata.sessionId;
            const sessionExternalMeta = metadata.session_external_id ?? metadata.sessionExternalId;

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

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setActiveSessionExternalId(null);
        setMessages([]);
        setToolEvents({});
      }

      setActiveMenu(null);
      void loadSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setActiveSessionExternalId(null);
    setMessages([]);
    setToolEvents({});
    setIsDrawerOpen(false);
  };

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

  // Show error if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="chats-page">
        <div className="auth-wrapper">
          <AuthPrompt title="Sign in to access chat" />
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
            className="actions-menu"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button
              className="menu-item"
              onClick={() => {
                setActiveMenu(null);
                // Edit functionality can be added later
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
          <button className="new-chat-btn" onClick={handleNewChat}>
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
                <div
                  key={session.id}
                  className={`chat-history-item ${activeSessionId === session.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setActiveSessionExternalId(session.external_id ?? null);
                  }}
                >
                  <span className="chat-title">{session.title || "New Chat"}</span>
                  <div className="chat-actions">
                    <button
                      ref={(el) => {
                        actionButtonRefs.current[session.id] = el;
                      }}
                      className="actions-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === session.id ? null : session.id);
                      }}
                    >
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showChatDetail && (
          <div className="chat-messages">
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                    </div>
                    <div className="message-content">
                      <div dangerouslySetInnerHTML={{
                        __html: message.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />')
                      }} />
                    </div>
                  </div>
                ))}

                {/* Show streaming content while assistant is responding */}
                {streamingContent && (
                  <div className="message-wrapper assistant streaming">
                    <div className="message-avatar">
                      <svg className="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="message-content">
                      <div>{streamingContent}</div>
                      <div className="typing-cursor"></div>
                    </div>
                  </div>
                )}

                {/* Show typing indicator with status */}
                {isSending && !streamingContent && (
                  <div className="message-wrapper assistant thinking">
                    <div className="message-avatar">
                      <svg className="avatar-icon animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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

        <ChatComposer
          onFirstSend={() => setShowChatDetail(true)}
          onSend={handleSendMessage}
          isLoading={isSending}
        />
      </div>

      {showChatDetail && Object.keys(toolEvents).length > 0 && (
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
              {Object.entries(toolEvents).map(([toolName, count]) => (
                  <div key={toolName} className="tool-card">
                    <div className="tool-icon">
                      {toolName.toLowerCase().includes('search') ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      ) : toolName.toLowerCase().includes('fetch') || toolName.toLowerCase().includes('web') ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      ) : toolName.toLowerCase().includes('time') || toolName.toLowerCase().includes('date') ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : toolName.toLowerCase().includes('document') || toolName.toLowerCase().includes('file') ? (
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
                      <div className="tool-name">
                        {toolName}
                        {count > 1 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>×{count}</span>}
                      </div>
                      <div className="tool-description">
                        Called {count} {count === 1 ? 'time' : 'times'}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
