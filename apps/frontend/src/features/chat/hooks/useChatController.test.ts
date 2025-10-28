import { describe, expect, it, vi } from "vitest";

import { createStreamFailureHandler } from "./useChatController";
import type { ChatMessage } from "../types";
import type { ChatLogEntry, ChatToolEvent } from "@/lib/types";

describe("createStreamFailureHandler", () => {
  it("restores optimistic state and reports the failure only once", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "assistant",
        content: "Earlier response",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];
    const timeline: ChatToolEvent[] = [
      {
        tool: "search",
        status: "complete",
        ts: "2024-01-01T00:00:00Z",
      },
    ];
    const logs: ChatLogEntry[] = [
      {
        level: "info",
        msg: "previous log entry",
      },
    ];

    const setMessages = vi.fn();
    const setToolTimeline = vi.fn();
    const setLogEntries = vi.fn();
    const setTranscript = vi.fn();
    const setInput = vi.fn();
    const stopStreaming = vi.fn();
    const reportError = vi.fn();
    const logError = vi.fn();

    const handleFailure = createStreamFailureHandler(
      {
        messages,
        toolTimeline: timeline,
        logEntries: logs,
        transcript: "previous transcript",
        sttMeta: { confidence: 0.9, language: "en" },
        inputValue: "Hello there",
      },
      {
        setMessages,
        setToolTimeline,
        setLogEntries,
        setTranscript,
        setInput,
        stopStreaming,
        reportError,
        logError,
      }
    );

    const networkError = new Error("Network down");
    handleFailure("Network down", networkError);

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(setMessages).toHaveBeenCalledWith(messages);
    expect(setToolTimeline).toHaveBeenCalledWith(timeline);
    expect(setLogEntries).toHaveBeenCalledWith(logs);
    expect(setTranscript).toHaveBeenCalledWith("previous transcript", {
      confidence: 0.9,
      language: "en",
    });
    expect(setInput).toHaveBeenCalledWith("Hello there");
    expect(reportError).toHaveBeenCalledWith("Network down");
    expect(logError).toHaveBeenCalledWith(networkError);
    expect(stopStreaming).toHaveBeenCalledTimes(1);

    handleFailure("Network down", new Error("Retry"));

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(setToolTimeline).toHaveBeenCalledTimes(1);
    expect(setLogEntries).toHaveBeenCalledTimes(1);
    expect(setTranscript).toHaveBeenCalledTimes(1);
    expect(setInput).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(stopStreaming).toHaveBeenCalledTimes(2);
  });

  it("supports handlers without input restoration", () => {
    const setMessages = vi.fn();
    const setToolTimeline = vi.fn();
    const setLogEntries = vi.fn();
    const setTranscript = vi.fn();
    const stopStreaming = vi.fn();
    const reportError = vi.fn();
    const logError = vi.fn();

    const handleFailure = createStreamFailureHandler(
      {
        messages: [],
        toolTimeline: [],
        logEntries: [],
        transcript: null,
        sttMeta: {},
      },
      {
        setMessages,
        setToolTimeline,
        setLogEntries,
        setTranscript,
        stopStreaming,
        reportError,
        logError,
      }
    );

    handleFailure("Streaming error");

    expect(setMessages).toHaveBeenCalledTimes(1);
    expect(setToolTimeline).toHaveBeenCalledTimes(1);
    expect(setLogEntries).toHaveBeenCalledTimes(1);
    expect(setTranscript).toHaveBeenCalledWith(null, {});
    expect(reportError).toHaveBeenCalledWith("Streaming error");
    expect(logError).not.toHaveBeenCalled();
    expect(stopStreaming).toHaveBeenCalledTimes(1);
  });
});
