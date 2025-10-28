"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Loader2,
  RefreshCw,
  Plus,
  Sparkles,
  Trash2,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SessionSummary } from "@/lib/types";

interface SessionSidebarProps {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefresh: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary, title: string) => void;
  onDeleteSession: (session: SessionSummary) => void;
  deriveSessionName: (session: SessionSummary | null) => string;
}

export function SessionSidebar({
  sessions,
  sessionsLoading,
  activeSession,
  onRefresh,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  deriveSessionName,
}: SessionSidebarProps) {
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  const closeRenameDialog = () => {
    setRenameTarget(null);
    setRenameValue("");
  };

  const openRenameDialog = (session: SessionSummary) => {
    setRenameTarget(session);
    setRenameValue(session.title ?? deriveSessionName(session));
  };

  return (
    <aside className="hidden w-[320px] flex-col border-r border-border/60 bg-card/70 p-4 lg:flex">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
          <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onRefresh} aria-label="Refresh sessions">
          {sessionsLoading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <Button
        variant="secondary"
        className="mb-4 w-full gap-2 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
        onClick={onNewSession}
        data-testid="new-session"
      >
        <Plus className="h-4 w-4" />
        New Conversation
      </Button>

      <div className="flex-1 space-y-3 overflow-auto pr-2">
        {sessionsLoading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </>
        ) : sessions.length === 0 ? (
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
                onClick={() => onSelectSession(session)}
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
                      openRenameDialog(session);
                    }}
                    aria-label="Rename session"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(session);
                    }}
                    aria-label="Delete session"
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

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => (!open ? closeRenameDialog() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Choose a concise title so you can recognize this session later.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Team sync notes"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={closeRenameDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!renameTarget) return;
                const trimmed = renameValue.trim();
                if (!trimmed) return;
                onRenameSession(renameTarget, trimmed);
                closeRenameDialog();
              }}
              disabled={!renameValue.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? deriveSessionName(deleteTarget) : ""} will be removed permanently. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  onDeleteSession(deleteTarget);
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
