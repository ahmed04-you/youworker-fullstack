"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Cpu,
  Volume2,
  ArrowRight,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { ChatToolEvent, ChatLogEntry } from "@/lib/types";

interface HealthStatus {
  status: string;
  components?: {
    ollama?: {
      ready: boolean;
      missing: string[];
      models: Record<
        string,
        {
          name: string;
          available: boolean;
        }
      >;
    };
    agent?: string;
    voice?: {
      stt_available: boolean;
      tts_available: boolean;
    };
  };
}

interface SttMeta {
  confidence?: number;
  language?: string;
}

interface InsightSidebarProps {
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];
  transcript: string | null;
  sttMeta: SttMeta;
  health: HealthStatus | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
}

export function InsightSidebar({
  toolTimeline,
  logEntries,
  transcript,
  sttMeta,
  health,
  healthLoading,
  onRefreshHealth,
}: InsightSidebarProps) {
  return (
    <aside className="hidden w-[320px] space-y-5 xl:flex xl:flex-col">
      <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Tool timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {toolTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tools spring into action while you chat. You&apos;ll see them here in real time.
            </p>
          ) : (
            <div className="space-y-3">
              {toolTimeline.slice(-6).map((event, index) => (
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
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {event.status}
                    </Badge>
                  </div>
                  {event.latency_ms && (
                    <p className="mt-1 text-muted-foreground">
                      {event.latency_ms} ms •{" "}
                      {event.result_preview?.slice(0, 60)}
                      {event.result_preview && event.result_preview.length > 60 ? "…" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
          >
            View analytics <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Cpu className="h-4 w-4 text-primary" />
            Reasoning trace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {logEntries.length === 0 ? (
            <p className="text-muted-foreground">
              We&apos;ll surface the thought process, warnings, and tool diagnostics here.
            </p>
          ) : (
            logEntries.slice(-8).map((log, index) => (
              <div
                key={`${log.level}-${index}`}
                className="rounded-2xl border border-border/40 bg-background/60 px-3 py-2"
              >
                <span className="font-semibold uppercase tracking-wide text-primary">
                  {log.level}
                </span>
                <p className="mt-1 text-muted-foreground">{log.msg}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4 text-primary" />
            Voice capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transcript ? (
            <div className="space-y-2 text-sm">
              <p
                className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-foreground"
                data-testid="transcript"
              >
                {transcript}
              </p>
              <p className="text-xs text-muted-foreground">
                Confidence {(sttMeta.confidence ?? 0).toFixed(2)} •{" "}
                {sttMeta.language?.toUpperCase() || "auto"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              When you speak to YouWorker we transcribe locally and surface the transcript
              here.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="h-4 w-4 text-primary" />
            System health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {health ? (
            <>
              <div className="flex items-center gap-2">
                <Badge
                  className={`rounded-full text-[10px] uppercase tracking-wider ${
                    health.status === "healthy"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {health.status}
                </Badge>
                <span className="text-muted-foreground">
                  {health.components?.agent === "ready"
                    ? "Agent ready"
                    : "Agent warming up"}
                </span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2">
                <p className="font-semibold text-foreground">Models</p>
                <div className="mt-2 space-y-1">
                  {health.components?.ollama?.models &&
                    Object.entries(health.components.ollama.models).map(([key, model]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-muted-foreground"
                      >
                        <span>{model.name}</span>
                        <span
                          className={
                            model.available
                              ? "text-emerald-600"
                              : "text-destructive font-medium"
                          }
                        >
                          {model.available ? "ready" : "missing"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Health data will appear once the agent connects to the backend.
            </p>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
