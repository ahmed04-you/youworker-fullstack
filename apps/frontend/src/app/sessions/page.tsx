"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import { SessionDetail, SessionMessage, SessionSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SessionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/settings");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void refreshSessions();
    }
  }, [authLoading, isAuthenticated, limit]);

  const totalMessages = useMemo(() => {
    return sessionDetail?.session.messages.length ?? 0;
  }, [sessionDetail]);

  const refreshSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await apiGet<{ sessions: SessionSummary[] }>("/v1/sessions", {
        query: { limit },
      });
      setSessions(response.sessions);
      if (response.sessions.length && !selectedSession) {
        void handleSelectSession(response.sessions[0]);
      }
    } catch (error) {
      console.error(error);
      toast.error("Unable to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSelectSession = async (session: SessionSummary) => {
    setSelectedSession(session);
    setDetailLoading(true);
    try {
      const detail = await apiGet<SessionDetail>(`/v1/sessions/${session.id}`);
      setSessionDetail(detail);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load session detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteSession = async (session: SessionSummary) => {
    if (session.id <= 0) return;
    try {
      await apiDelete(`/v1/sessions/${session.id}`);
      toast.success("Session removed.");
      setSessionDetail(null);
      setSelectedSession(null);
      await refreshSessions();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete session.");
    }
  };

  const handleRenameSession = async (session: SessionSummary) => {
    if (session.id <= 0) return;
    const title = window.prompt("Rename session", session.title || "");
    if (title === null) return;
    try {
      await apiPatch(`/v1/sessions/${session.id}`, undefined, { query: { title } });
      toast.success("Session renamed.");
      await refreshSessions();
    } catch (error) {
      console.error(error);
      toast.error("Unable to rename session.");
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-3xl border border-border px-6 py-8 text-sm text-muted-foreground shadow-sm">
          Authenticating…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Conversation archive
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Replay every assistant turn</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Explore transcripts, tool invocations, and reasoning for each chat session. Rename,
              clean up, or relaunch a conversation from the captured metadata.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-9 rounded-full border border-border/70 bg-background/80 px-4 text-xs font-semibold text-foreground focus:outline-none"
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  Showing {value}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => refreshSessions()}
            >
              {sessionsLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

  <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Session list
            </CardTitle>
            <CardDescription>Pick a session to view transcripts and metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionsLoading ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                No sessions yet. Start a conversation on the chat page.
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === selectedSession?.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-primary/60 bg-primary/10 shadow-sm"
                        : "border-transparent bg-background/70 hover:border-border/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {session.title || session.external_id || `Session #${session.id}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated {new Date(session.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
                        {session.enable_tools ? "tools" : "chat"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{session.model || "default model"}</span>
                      <span>•</span>
                      <span>{new Date(session.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs text-muted-foreground hover:text-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRenameSession(session);
                        }}
                      >
                        <NotebookPen className="mr-1 h-3.5 w-3.5" />
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteSession(session);
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Session detail
              </CardTitle>
              <CardDescription>
                Rich transcript, reasoning context, and metadata for the selected session.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full">
                {totalMessages} messages
              </Badge>
              {selectedSession?.model && (
                <Badge variant="outline" className="rounded-full">
                  {selectedSession.model}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex h-[520px] flex-col overflow-hidden">
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading conversation…
              </div>
            ) : !sessionDetail ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="h-5 w-5 text-primary" />
                Select a session from the list to inspect its messages.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {sessionDetail.session.messages.map((message: SessionMessage) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 ${
                      message.role === "user"
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/70 bg-background/80 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                      <span className="font-semibold">
                        {message.role === "user" ? "User" : "YouWorker"}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                    {message.tool_call_name && (
                      <Badge variant="outline" className="self-start rounded-full text-[10px] uppercase">
                        Tool call: {message.tool_call_name}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
