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

import { formatRelativeTime } from "@/lib/time-utils";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import { SessionDetail, SessionMessage, SessionSummary } from "@/lib/types";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RenameSessionDialog } from "@/components/dialogs/RenameSessionDialog";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";

export default function SessionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameSession, setRenameSession] = useState<SessionSummary | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteSession, setDeleteSession] = useState<SessionSummary | null>(null);

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

  const filteredSessions = useMemo(() => {
    if (!searchTerm) return sessions;
    const term = searchTerm.toLowerCase();
    return sessions.filter((session) => {
      const title = session.title?.toLowerCase() || '';
      const externalId = session.external_id?.toLowerCase() || '';
      return title.includes(term) || externalId.includes(term);
    });
  }, [sessions, searchTerm]);

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


  const handleRenameSession = async (sessionId: number, title: string) => {
    try {
      await apiPatch(`/v1/sessions/${sessionId}`, undefined, { query: { title } });
      toast.success("Session renamed.");
      await refreshSessions();
    } catch (error) {
      console.error(error);
      toast.error("Unable to rename session.");
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSession || deleteSession.id <= 0) return;
    try {
      await apiDelete(`/v1/sessions/${deleteSession.id}`);
      toast.success("Session removed.");
      setSessionDetail(null);
      setSelectedSession(null);
      await refreshSessions();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete session.");
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-3xl border border-border px-6 py-8 text-sm text-muted-foreground shadow-sm">
          Authenticating…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card/70 p-4 md:p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Conversation archive
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">Replay every assistant turn</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Explore transcripts, tool invocations, and reasoning for each chat session. Rename,
              clean up, or relaunch a conversation from the captured metadata.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-full border border-border/70 bg-background/80 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Search sessions"
            />
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-9 rounded-full border border-border/70 bg-background/80 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Sessions per page"
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  Showing {value}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              className="rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground focus:ring-2 focus:ring-primary/30"
              onClick={() => refreshSessions()}
              disabled={sessionsLoading}
              aria-label="Refresh sessions"
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
              <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
              Session list
            </CardTitle>
            <CardDescription>Pick a session to view transcripts and metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionsLoading ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                Loading sessions…
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
                No sessions match your search. Try adjusting the search term.
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredSessions.map((session) => {
                  const isActive = session.id === selectedSession?.id;
                  return (
                    <li key={session.id}>
                      <button
                        onClick={() => handleSelectSession(session)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                          isActive
                            ? "border-primary/60 bg-primary/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            : "border-transparent bg-background/70 hover:border-border/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
                        }`}
                        aria-label={`Select session: ${session.title || session.external_id || `Session #${session.id}`}`}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {session.title || session.external_id || `Session #${session.id}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Updated {formatRelativeTime(session.updated_at)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-wide"
                            aria-label={session.enable_tools ? "Tools enabled" : "Chat only"}
                          >
                            {session.enable_tools ? "tools" : "chat"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{session.model || "default model"}</span>
                          <span>•</span>
                          <time dateTime={session.created_at}>{new Date(session.created_at).toLocaleDateString()}</time>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-xs text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                            onClick={(event) => {
                              event.stopPropagation();
                              setRenameSession(session);
                              setIsRenameDialogOpen(true);
                            }}
                            aria-label="Rename session"
                          >
                            <NotebookPen className="mr-1 h-3.5 w-3.5" />
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-xs text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/30"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteSession(session);
                              setIsDeleteDialogOpen(true);
                            }}
                            aria-label="Delete session"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Session detail
              </CardTitle>
              <CardDescription>
                Rich transcript, reasoning context, and metadata for the selected session.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full" aria-label={`${totalMessages} messages`}>
                {totalMessages} messages
              </Badge>
              {selectedSession?.model && (
                <Badge variant="outline" className="rounded-full" aria-label={`Model: ${selectedSession.model}`}>
                  {selectedSession.model}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex h-full flex-col overflow-hidden">
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading conversation…
              </div>
            ) : !sessionDetail ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="h-5 w-5 text-primary" aria-hidden="true" />
                <p>Select a session from the list to inspect its messages.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2" role="log" aria-label="Session messages">
                {sessionDetail.session.messages.map((message: SessionMessage) => {
                  const isUser = message.role === "user";
                  const bubbleStyles = isUser
                    ? "ml-auto max-w-[80%] bg-primary text-primary-foreground shadow-lg"
                    : "mr-auto max-w-[80%] border border-border/70 bg-card/80 text-card-foreground shadow-sm";

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-2 rounded-2xl px-4 py-3 ${bubbleStyles}`}
                      role="logitem"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                        <span className="font-semibold">
                          {isUser ? "User" : "YouWorker"}
                        </span>
                        <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>
                          {formatRelativeTime(message.created_at)}
                        </time>
                      </div>
                      <Markdown className="text-sm leading-relaxed" aria-label={message.content}>
                        {message.content}
                      </Markdown>
                      {message.tool_call_name && (
                        <div className="flex items-center gap-2 text-xs" aria-label={`Tool call: ${message.tool_call_name}`}>
                          <Badge variant="secondary" className="rounded-full bg-background/40">
                            Tool
                          </Badge>
                          <span>{message.tool_call_name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RenameSessionDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        session={renameSession}
        onRename={handleRenameSession}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        title={`Delete "${deleteSession?.title || deleteSession?.external_id || `Session #${deleteSession?.id}`}"?`}
        description="This action cannot be undone. The session and all its messages will be permanently deleted."
        onConfirm={handleDeleteSession}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setDeleteSession(null);
        }}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
