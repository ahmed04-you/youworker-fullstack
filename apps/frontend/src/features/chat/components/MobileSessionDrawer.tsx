"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionSummary } from "@/lib/types";

import { SessionSidebar } from "./SessionSidebar";

type MobileSessionDrawerProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefresh: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary, title: string) => void;
  onDeleteSession: (session: SessionSummary) => void;
  deriveSessionName: (session: SessionSummary | null) => string;
};

export function MobileSessionDrawer({
  open = false,
  onOpenChange,
  sessions,
  sessionsLoading,
  activeSession,
  onRefresh,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  deriveSessionName,
}: MobileSessionDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <div />
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Conversations</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange?.(false)}
              className="h-8 w-8"
              aria-label="Close sessions"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-auto">
          <SessionSidebar
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeSession={activeSession}
            onRefresh={onRefresh}
            onNewSession={onNewSession}
            onSelectSession={onSelectSession}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
            deriveSessionName={deriveSessionName}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
