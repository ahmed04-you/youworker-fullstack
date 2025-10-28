"use client";

import { forwardRef, memo } from "react";
import { BrainCircuit, Sparkles, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { ChatMessageView } from "../types";

interface MessageListProps {
  messages: ChatMessageView[];
  onStartNewSession: () => void;
  emptyActionLabel?: string;
  onSamplePromptClick?: (prompt: string) => void;
}

const MessageBubble = memo(({ message }: { message: ChatMessageView }) => {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const bubbleStyles = isUser
    ? "ml-auto bg-primary text-primary-foreground shadow-lg"
    : isAssistant
      ? "mr-auto border border-border/70 bg-card/80 text-card-foreground shadow-sm"
      : "mx-auto bg-secondary text-secondary-foreground";

  return (
    <div
      className={`flex max-w-3xl flex-col gap-2 rounded-3xl px-5 py-4 ${bubbleStyles}`}
      data-testid="messages"
      role="article"
      aria-label={`Message from ${isUser ? "you" : isAssistant ? "assistant" : "system"}`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
        <span className="font-medium">
          {isUser ? "You" : isAssistant ? "assistant" : "System"}
        </span>
        <time dateTime={message.createdAt}>{message.createdAt}</time>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      {message.toolCallName && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="rounded-full bg-background/40">
            Tool
          </Badge>
          <span>{message.toolCallName}</span>
        </div>
      )}
      {message.streaming && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
          Streaming insight…
        </div>
      )}
      {isAssistant && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground" data-testid="response">
          assistant
        </span>
      )}
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, onStartNewSession, emptyActionLabel = "Start fresh", onSamplePromptClick }, ref) => {
    const samplePrompts = [
      "Explain quantum computing in simple terms",
      "Write a Python function to sort a list",
      "What are the latest trends in AI?",
      "Help me draft a professional email",
      "Summarize the key points from my documents",
      "Create a project timeline for a web app",
    ];

    if (messages.length === 0) {
      return (
        <div
          ref={ref}
          className="flex h-[calc(100vh-320px)] flex-col gap-6 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
          role="region"
          aria-label="Empty chat conversation"
        >
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary" aria-hidden="true">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Welcome to YouWorker.AI</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Start a conversation with crimson-fueled intelligence. Ask questions, request research, orchestrate tool workflows,
              or ingest knowledge on the fly.
            </p>

            {onSamplePromptClick && (
              <div className="w-full max-w-2xl">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Try these prompts
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {samplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSamplePromptClick(prompt)}
                      className="group rounded-xl border border-border/50 bg-card/50 p-3 text-left text-sm transition-all hover:border-primary/50 hover:bg-card hover:shadow-md"
                      aria-label={`Use sample prompt: ${prompt}`}
                    >
                      <span className="text-foreground/80 group-hover:text-foreground">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 text-sm">
              <Button variant="secondary" className="rounded-full" aria-label="Explore analytics page">
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> Explore analytics
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={onStartNewSession}
                aria-label="Start a new chat session"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {emptyActionLabel}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="flex h-[calc(100vh-320px)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    );
  }
);
MessageList.displayName = "MessageList";
