"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SessionSummary } from "@/lib/types";
import { SessionSidebar } from "./SessionSidebar";

interface MobileSessionDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  onRefresh: () => void;
  onNewSession: () => void;
  onSelectSession: (session: SessionSummary) => void;
  onRenameSession: (session: SessionSummary) => void;
  onDeleteSession: (session: SessionSummary) => void;
}

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
}: MobileSessionDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {/* This will be triggered externally, so no trigger needed here */}
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
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
