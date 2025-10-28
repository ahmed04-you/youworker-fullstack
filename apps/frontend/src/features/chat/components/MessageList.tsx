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
    <div className={`flex max-w-3xl flex-col gap-2 rounded-3xl px-5 py-4 ${bubbleStyles}`} data-testid="messages">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
        <span className="font-medium">
          {isUser ? "You" : isAssistant ? "assistant" : "System"}
        </span>
        <span>{message.createdAt}</span>
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
  ({ messages, onStartNewSession, emptyActionLabel = "Start fresh" }, ref) => {
    if (messages.length === 0) {
      return (
        <div
          ref={ref}
          className="flex h-[calc(100vh-320px)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
        >
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Welcome to YouWorker.AI</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Start a conversation with crimson-fueled intelligence. Ask questions, request research, orchestrate tool workflows,
              or ingest knowledge on the fly.
            </p>
            <div className="flex gap-2 text-sm">
              <Button variant="secondary" className="rounded-full">
                <Sparkles className="mr-2 h-4 w-4" /> Explore analytics
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={onStartNewSession}>
                <Plus className="mr-2 h-4 w-4" />
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
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    );
  }
);
MessageList.displayName = "MessageList";
