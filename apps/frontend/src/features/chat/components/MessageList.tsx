"use client";

import { forwardRef, memo, useEffect, useState } from "react";
import { BrainCircuit, Loader2, User, Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

import type { ChatMessageView } from "../types";

interface MessageListProps {
  messages: ChatMessageView[];
  onStartNewSession: () => void;
  emptyActionLabel?: string;
  onSamplePromptClick?: (prompt: string) => void;
}

const StreamingCursor = memo(() => (
  <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary animate-pulse" aria-hidden="true" />
));
StreamingCursor.displayName = "StreamingCursor";

const MessageBubble = memo(
  ({ message }: { message: ChatMessageView }) => {
    const isUser = message.role === "user";
    const isAssistant = message.role === "assistant";
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      // Trigger fade-in animation
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }, []);

    if (isUser) {
      // User message: bubble with gradient accent and enhanced styling
      return (
        <div
          className={`flex items-start gap-3 justify-end transition-all duration-300 ease-spring ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          data-testid="messages"
          role="article"
          aria-label="Message from you"
        >
          <div className="flex flex-col items-end gap-2 max-w-2xl">
            {/* Avatar with gradient */}
            <div className="relative">
              <div className="rounded-full gradient-accent p-2 shadow-md">
                <User className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Message bubble with enhanced styling */}
            <div className="group relative">
              <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow duration-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>

              {/* Timestamp on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground mt-1 text-right">
                {message.createdAt}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isAssistant) {
      // Assistant message: full width with enhanced styling
      return (
        <div
          className={`flex items-start gap-3 transition-all duration-300 ease-spring ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          data-testid="messages"
          role="article"
          aria-label="Message from assistant"
        >
          <div className="flex flex-col items-start gap-2 w-full max-w-4xl">
            {/* Avatar with subtle animation */}
            <div className="relative">
              <div className="rounded-full bg-primary/10 p-2 border border-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              {message.streaming && (
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-ping" />
              )}
            </div>

            {/* Message content with better styling */}
            <div className="group w-full">
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-muted/50 border border-border/50">
                <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                  <MarkdownRenderer content={message.content} />
                  {message.streaming && message.content && <StreamingCursor />}
                </div>

                {message.toolCallName && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary border border-primary/20">
                      <BrainCircuit className="h-3 w-3 mr-1" />
                      {message.toolCallName}
                    </Badge>
                  </div>
                )}

                {message.streaming && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-in mt-2">
                    <div className="relative flex items-center">
                      <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                    </div>
                    <span className="animate-pulse">Streaming insight…</span>
                  </div>
                )}
              </div>

              {/* Timestamp on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground mt-1">
                {message.createdAt}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // System message (fallback)
    return (
      <div
        className={`flex items-center justify-center transition-all duration-300 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        data-testid="messages"
        role="article"
        aria-label="System message"
      >
        <div className="rounded-lg px-2.5 py-1.5 bg-secondary text-secondary-foreground text-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if message content, streaming status, or tool info changes
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.streaming === nextProps.message.streaming &&
      prevProps.message.toolCallName === nextProps.message.toolCallName
    );
  }
);
MessageBubble.displayName = "MessageBubble";

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, onStartNewSession, emptyActionLabel = "Start fresh", onSamplePromptClick }, ref) => {
    const samplePrompts = [
      "Explain quantum computing",
      "Write a Python sort function",
      "Draft a professional email",
    ];

    if (messages.length === 0) {
      return (
        <div
          ref={ref}
          className="flex h-full flex-col gap-3 overflow-y-auto rounded-lg bg-background/70 p-3 shadow-inner animate-fade-in"
          role="region"
          aria-label="Empty chat conversation"
        >
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary animate-slide-in-up" aria-hidden="true">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">YouWorker.AI</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Ask questions, research, or run tools.
            </p>

            {onSamplePromptClick && (
              <div className="w-full max-w-xl">
                <div className="grid gap-1.5 grid-cols-3">
                  {samplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSamplePromptClick(prompt)}
                      className="group rounded-lg border border-border/50 bg-card/50 p-1.5 text-center text-xs transition-all duration-200 hover:border-primary/50 hover:bg-card hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                      aria-label={`Use sample prompt: ${prompt}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="text-foreground/80 group-hover:text-foreground transition-colors">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="flex h-full flex-col gap-2 overflow-y-auto rounded-lg bg-background/70 p-2 shadow-inner scroll-smooth"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    );
  }
);
MessageList.displayName = "MessageList";
