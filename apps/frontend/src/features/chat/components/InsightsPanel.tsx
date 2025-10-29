"use client";

import Link from "next/link";
import { memo } from "react";
import {
  Sparkles,
  ChevronRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ChatLogEntry, ChatToolEvent } from "@/lib/types";

import type { HealthStatus, SpeechTranscriptMeta } from "../types";

/**
 * Props for InsightsPanel and InsightsContent components
 */
interface InsightsProps {
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];
  transcript: string | null;
  sttMeta: SpeechTranscriptMeta;
  health: HealthStatus | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
}

function InsightsContent({
  toolTimeline,
}: Pick<InsightsProps, 'toolTimeline'>) {
  return (
    <Card className="rounded-3xl border border-border bg-card/70 shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Tool timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3">
        {toolTimeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tools spring into action while you chat. You&apos;ll see them here in real time.
          </p>
        ) : (
          <div className="space-y-3">
            {toolTimeline.map((event, index) => (
              <div
                key={`${event.tool}-${event.status}-${index}`}
                className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{event.tool}</span>
                  <Badge
                    className={`rounded-full text-[10px] uppercase tracking-wider ${
                      event.status === "start"
                        ? "bg-primary/10 text-primary"
                        : event.status === "success"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {event.status}
                  </Badge>
                </div>
                {event.latency_ms && (
                  <p className="mt-1 text-muted-foreground">
                    {event.latency_ms} ms • {event.result_preview?.slice(0, 60)}
                    {event.result_preview && event.result_preview.length > 60 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline mt-3"
        >
          View analytics <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Insights panel component displaying real-time tool timeline
 *
 * Shows tool execution timeline for the active chat session.
 * Designed for desktop display (hidden on mobile, use
 * MobileInsightsDrawer instead). Optimized with React.memo for performance.
 *
 * @component
 * @param {InsightsProps} props - Component props
 * @param {ChatToolEvent[]} props.toolTimeline - Timeline of tool executions
 *
 * Features:
 * - Tool timeline showing recent tool executions with status badges
 * - Link to full analytics dashboard
 * - Auto-displays last 6 tool events
 * - Status-based color coding (success, error, in-progress)
 * - Desktop only (hidden on mobile via xl:flex)
 *
 * @see {@link MobileInsightsDrawer} for mobile equivalent
 */
export const InsightsPanel = memo(function InsightsPanel(props: InsightsProps) {
  return (
    <aside className="hidden w-[320px] xl:flex xl:flex-col overflow-hidden h-full">
      <InsightsContent toolTimeline={props.toolTimeline} />
    </aside>
  );
});
InsightsPanel.displayName = "InsightsPanel";

/**
 * Props for the MobileInsightsDrawer component
 */
interface MobileInsightsDrawerProps extends InsightsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mobile drawer for insights panel
 *
 * Bottom sheet drawer variant of InsightsPanel optimized for mobile devices.
 * Displays tool timeline in a mobile-friendly drawer format.
 *
 * @component
 * @param {MobileInsightsDrawerProps} props - Component props
 * @param {boolean} props.open - Whether drawer is open
 * @param {function} props.onOpenChange - Handler for drawer open state
 * @param {ChatToolEvent[]} props.toolTimeline - Timeline of tool executions
 *
 * Features:
 * - Bottom sheet presentation (70% viewport height)
 * - Rounded top corners for modern mobile UI
 * - Scrollable content area
 * - Swipe-to-dismiss gesture support
 *
 * @see {@link InsightsPanel} for desktop equivalent
 */
export const MobileInsightsDrawer = memo(function MobileInsightsDrawer({
  open,
  onOpenChange,
  toolTimeline,
}: MobileInsightsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <div />
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto rounded-t-3xl border-border bg-background px-4 py-6">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-center text-base font-semibold">Tool Timeline</SheetTitle>
        </SheetHeader>
        <InsightsContent toolTimeline={toolTimeline} />
      </SheetContent>
    </Sheet>
  );
});
MobileInsightsDrawer.displayName = "MobileInsightsDrawer";
