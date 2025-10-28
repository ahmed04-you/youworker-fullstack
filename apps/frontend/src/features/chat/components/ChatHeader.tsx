"use client";

import { memo } from "react";
import { MessageCircle, Radio, Cpu, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionSummary } from "@/lib/types";

import { MobileSessionDrawer } from "./MobileSessionDrawer";

/**
 * Props for the ChatHeader component
 */
interface ChatHeaderProps {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefreshSessions: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary, title: string) => void;
  onDeleteSession: (session: SessionSummary) => void;
  onRefreshHealth: () => void;
  healthLoading: boolean;
  isStreaming: boolean;
  enableTools: boolean;
  deriveSessionName: (session: SessionSummary | null) => string;
  onOpenInsights: () => void;
  mobileDrawerOpen: boolean;
  onMobileDrawerChange: (open: boolean) => void;
}

/**
 * Chat header component displaying session info and system status
 *
 * Displays the active chat session name, model badge, streaming status,
 * tools status, and system health refresh button. On mobile, includes
 * a drawer toggle for session management and an insights panel trigger.
 * Optimized with React.memo for performance.
 *
 * @component
 * @param {ChatHeaderProps} props - Component props
 * @param {SessionSummary[]} props.sessions - List of all chat sessions
 * @param {boolean} props.sessionsLoading - Whether sessions are loading
 * @param {SessionSummary | null} props.activeSession - Currently active session
 * @param {function} props.onRefreshSessions - Handler to refresh sessions list
 * @param {function} props.onNewSession - Handler to create a new session
 * @param {function} props.onSelectSession - Handler when a session is selected
 * @param {function} props.onRenameSession - Handler to rename a session
 * @param {function} props.onDeleteSession - Handler to delete a session
 * @param {function} props.onRefreshHealth - Handler to refresh system health
 * @param {boolean} props.healthLoading - Whether health data is loading
 * @param {boolean} props.isStreaming - Whether AI is currently streaming
 * @param {boolean} props.enableTools - Whether tools are enabled
 * @param {function} props.deriveSessionName - Function to derive session display name
 * @param {function} props.onOpenInsights - Handler to open insights panel (mobile)
 * @param {boolean} props.mobileDrawerOpen - Whether mobile session drawer is open
 * @param {function} props.onMobileDrawerChange - Handler for mobile drawer state
 *
 * @example
 * ```tsx
 * <ChatHeader
 *   sessions={sessions}
 *   sessionsLoading={false}
 *   activeSession={currentSession}
 *   onRefreshSessions={refreshSessions}
 *   onNewSession={createSession}
 *   onSelectSession={selectSession}
 *   onRenameSession={renameSession}
 *   onDeleteSession={deleteSession}
 *   onRefreshHealth={refreshHealth}
 *   healthLoading={false}
 *   isStreaming={false}
 *   enableTools={true}
 *   deriveSessionName={getSessionName}
 *   onOpenInsights={openInsights}
 *   mobileDrawerOpen={false}
 *   onMobileDrawerChange={setDrawerOpen}
 * />
 * ```
 *
 * Features:
 * - Session name display with model badge
 * - Real-time streaming indicator with pulse animation
 * - Tools status badge
 * - System health refresh button with loading state
 * - Mobile session drawer integration
 * - Mobile insights panel trigger
 * - Responsive layout adapting to screen size
 *
 * @see {@link MobileSessionDrawer} for mobile session management
 */
export const ChatHeader = memo(function ChatHeader({
  sessions,
  sessionsLoading,
  activeSession,
  onRefreshSessions,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onRefreshHealth,
  healthLoading,
  isStreaming,
  enableTools,
  deriveSessionName,
  onOpenInsights,
  mobileDrawerOpen,
  onMobileDrawerChange,
}: ChatHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <MobileSessionDrawer
        open={mobileDrawerOpen}
        onOpenChange={onMobileDrawerChange}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        activeSession={activeSession}
        onRefresh={onRefreshSessions}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
        deriveSessionName={deriveSessionName}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => onMobileDrawerChange(true)}
          aria-label="Open sessions drawer"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active session</p>
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
          <Radio className={`h-3.5 w-3.5 ${isStreaming ? "motion-safe:animate-pulse" : ""}`} />
          {isStreaming ? "Streaming answer" : "Idle"}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Cpu className="h-3.5 w-3.5" />
          {enableTools ? "Tools enabled" : "Tools paused"}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenInsights}
          aria-label="Open insights"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="rounded-full border-primary/40 text-primary"
          onClick={onRefreshHealth}
          aria-label="Refresh system health"
        >
          {healthLoading ? (
            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Refresh health
        </Button>
      </div>
    </div>
  );
});
ChatHeader.displayName = "ChatHeader";
