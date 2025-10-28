"use client";

import { useState } from "react";
import { MessageCircle, Radio, Cpu, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileSessionDrawer } from "./MobileSessionDrawer";
import { useChatStore } from "@/stores/chat-store";
import { SessionSummary } from "@/lib/types";

interface ChatHeaderProps {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefresh: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary) => void;
  onDeleteSession: (session: SessionSummary) => void;
  healthLoading: boolean;
  fetchHealth: () => void;
  isStreaming: boolean;
  enableTools: boolean;
}

function deriveSessionName(session: SessionSummary | null): string {
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

export function ChatHeader({
  sessions,
  sessionsLoading,
  activeSession,
  onRefresh,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  healthLoading,
  fetchHealth,
  isStreaming,
  enableTools,
}: ChatHeaderProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <>
      <MobileSessionDrawer
        open={mobileDrawerOpen}
        onOpenChange={setMobileDrawerOpen}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSession={activeSession}
        onRefresh={onRefresh}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
      />
      <div className="border-b border-border/60 bg-card/70 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open sessions drawer"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Active session
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                <MessageCircle className="h-5 w-5 text-primary" />
                {deriveSessionName(activeSession)}
                {activeSession && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/40 text-[10px] uppercase tracking-wide text-primary"
                  >
                    {activeSession.model?.split(":")[0] || "auto"}
                  </Badge>
                )}
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
              onClick={fetchHealth}
              aria-label="Refresh system health"
            >
              {healthLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Refresh health
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
