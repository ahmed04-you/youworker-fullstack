/**
 * Tool event tracking and management hook.
 */

"use client";

import { useState, useCallback, useMemo } from "react";

export interface ToolEvent {
  tool: string;
  status: "start" | "end" | "error";
  args?: any;
  result?: any;
  result_preview?: string;
  error?: string;
  latency_ms?: number;
  ts: string;
}

export interface ToolEventGroup {
  tool: string;
  startEvent: ToolEvent;
  endEvent?: ToolEvent;
  duration?: number;
  status: "running" | "completed" | "error";
}

export interface UseToolEventsReturn {
  events: ToolEvent[];
  groupedEvents: ToolEventGroup[];
  addEvent: (event: ToolEvent) => void;
  clearEvents: () => void;
  getEventsByTool: (toolName: string) => ToolEvent[];
  getLatestEvent: () => ToolEvent | null;
  getRunningTools: () => string[];
  getTotalDuration: () => number;
}

export function useToolEvents(): UseToolEventsReturn {
  const [events, setEvents] = useState<ToolEvent[]>([]);

  const addEvent = useCallback((event: ToolEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const getEventsByTool = useCallback(
    (toolName: string): ToolEvent[] => {
      return events.filter((event) => event.tool === toolName);
    },
    [events]
  );

  const getLatestEvent = useCallback((): ToolEvent | null => {
    return events.length > 0 ? events[events.length - 1] : null;
  }, [events]);

  const getRunningTools = useCallback((): string[] => {
    const running = new Set<string>();
    const completed = new Set<string>();

    for (const event of events) {
      if (event.status === "start") {
        running.add(event.tool);
      } else if (event.status === "end" || event.status === "error") {
        completed.add(event.tool);
      }
    }

    // Remove completed tools from running set
    for (const tool of completed) {
      running.delete(tool);
    }

    return Array.from(running);
  }, [events]);

  const getTotalDuration = useCallback((): number => {
    return events.reduce((total, event) => {
      if (event.latency_ms) {
        return total + event.latency_ms;
      }
      return total;
    }, 0);
  }, [events]);

  // Group events by tool invocation
  const groupedEvents = useMemo((): ToolEventGroup[] => {
    const groups: ToolEventGroup[] = [];
    const pendingStarts: Map<string, ToolEvent> = new Map();

    for (const event of events) {
      if (event.status === "start") {
        pendingStarts.set(event.tool, event);
      } else if (event.status === "end" || event.status === "error") {
        const startEvent = pendingStarts.get(event.tool);
        if (startEvent) {
          const startTime = new Date(startEvent.ts).getTime();
          const endTime = new Date(event.ts).getTime();
          const duration = endTime - startTime;

          groups.push({
            tool: event.tool,
            startEvent,
            endEvent: event,
            duration,
            status: event.status === "error" ? "error" : "completed",
          });

          pendingStarts.delete(event.tool);
        } else {
          // End event without start (shouldn't happen, but handle gracefully)
          groups.push({
            tool: event.tool,
            startEvent: event,
            endEvent: event,
            status: event.status === "error" ? "error" : "completed",
          });
        }
      }
    }

    // Add remaining pending starts as running
    for (const [tool, startEvent] of pendingStarts) {
      groups.push({
        tool,
        startEvent,
        status: "running",
      });
    }

    return groups;
  }, [events]);

  return {
    events,
    groupedEvents,
    addEvent,
    clearEvents,
    getEventsByTool,
    getLatestEvent,
    getRunningTools,
    getTotalDuration,
  };
}

/**
 * Hook for tracking tool performance metrics.
 */
export function useToolMetrics() {
  const [metrics, setMetrics] = useState<Map<string, ToolMetrics>>(new Map());

  const recordToolExecution = useCallback((event: ToolEventGroup) => {
    setMetrics((prev) => {
      const newMetrics = new Map(prev);
      const existing = newMetrics.get(event.tool) || {
        tool: event.tool,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
      };

      existing.totalRuns++;
      if (event.status === "completed") {
        existing.successfulRuns++;
      } else if (event.status === "error") {
        existing.failedRuns++;
      }

      if (event.duration) {
        existing.totalDuration += event.duration;
        existing.avgDuration = existing.totalDuration / existing.totalRuns;
        existing.minDuration = Math.min(existing.minDuration, event.duration);
        existing.maxDuration = Math.max(existing.maxDuration, event.duration);
      }

      newMetrics.set(event.tool, existing);
      return newMetrics;
    });
  }, []);

  const getMetrics = useCallback(
    (toolName: string): ToolMetrics | null => {
      return metrics.get(toolName) || null;
    },
    [metrics]
  );

  const getAllMetrics = useCallback((): ToolMetrics[] => {
    return Array.from(metrics.values());
  }, [metrics]);

  const clearMetrics = useCallback(() => {
    setMetrics(new Map());
  }, []);

  return {
    recordToolExecution,
    getMetrics,
    getAllMetrics,
    clearMetrics,
  };
}

export interface ToolMetrics {
  tool: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}
