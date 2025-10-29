"use client";

import { memo, useState } from "react";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionSummary } from "@/lib/types";

/**
 * Props for the SessionSidebar component
 */
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

/**
 * Session sidebar for managing chat conversations
 *
 * Displays a list of chat sessions with options to create, select, rename,
 * and delete sessions. Shows session metadata including last updated time,
 * model used, and tools status. Includes a Knowledge Hub link to documents.
 * Optimized with React.memo for performance. Hidden on mobile (drawer used instead).
 *
 * @component
 * @param {SessionSidebarProps} props - Component props
 * @param {SessionSummary[]} props.sessions - List of all chat sessions
 * @param {boolean} props.sessionsLoading - Whether sessions are loading
 * @param {SessionSummary | null} props.activeSession - Currently active session
 * @param {function} props.onRefresh - Handler to refresh sessions list
 * @param {function} props.onNewSession - Handler to create a new session
 * @param {function} props.onSelectSession - Handler when a session is selected
 * @param {function} props.onRenameSession - Handler to rename a session
 * @param {function} props.onDeleteSession - Handler to delete a session
 * @param {function} props.deriveSessionName - Function to derive session display name
 *
 * @example
 * ```tsx
 * <SessionSidebar
 *   sessions={sessions}
 *   sessionsLoading={false}
 *   activeSession={currentSession}
 *   onRefresh={refreshSessions}
 *   onNewSession={createSession}
 *   onSelectSession={selectSession}
 *   onRenameSession={renameSession}
 *   onDeleteSession={deleteSession}
 *   deriveSessionName={getSessionName}
 * />
 * ```
 *
 * Features:
 * - Scrollable session list with active state highlighting
 * - "New Conversation" button prominently displayed
 * - Refresh button with loading spinner
 * - Session cards showing name, timestamp, model, and tools status
 * - Inline rename and delete actions per session
 * - Confirmation dialogs for rename and delete operations
 * - Loading skeleton states during data fetch
 * - Empty state with helpful message
 * - Knowledge Hub info card with link to documents
 * - Desktop only (hidden on mobile via lg:flex)
 *
 * @see {@link MobileSessionDrawer} for mobile equivalent
 */
export const SessionSidebar = memo(function SessionSidebar({
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
    <aside className="hidden w-[280px] flex-col border-r border-border/60 bg-card/70 p-4 lg:flex">
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
              <div key={i} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
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
              <div
                key={session.id}
                className={`w-full rounded-2xl border px-3 py-2 text-left transition group ${
                  isActive
                    ? "border-primary/60 bg-primary/10 shadow-sm"
                    : "border-transparent bg-background/60 hover:border-border/80 hover:bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onSelectSession(session)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSession(session);
                      }
                    }}
                  >
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {deriveSessionName(session)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Session options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameDialog(session);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(session);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
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
});
SessionSidebar.displayName = "SessionSidebar";
