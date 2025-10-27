"use client";

import { useState } from "react";
import { SessionSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  Plus,
  Sparkles,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface MobileSessionDrawerProps {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefresh: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary) => void;
  onDeleteSession: (session: SessionSummary) => void;
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

export function MobileSessionDrawer({
  sessions,
  sessionsLoading,
  activeSession,
  onRefresh,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: MobileSessionDrawerProps) {
  const [open, setOpen] = useState(false);

  const handleSelectSession = (session: SessionSummary) => {
    onSelectSession(session);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden rounded-full"
          aria-label="Open sessions menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Conversations</SheetTitle>
              <SheetDescription>Manage your chat sessions</SheetDescription>
            </div>
            <Button size="icon" variant="ghost" onClick={onRefresh}>
              {sessionsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Button
            variant="secondary"
            className="w-full gap-2 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => {
              onNewSession();
              setOpen(false);
            }}
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>

          <div className="space-y-3">
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
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/40 text-[10px] uppercase tracking-wide text-primary"
                      >
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
                          onRenameSession(session);
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
                          onDeleteSession(session);
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
