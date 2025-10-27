/**
 * MessageBubble component - displays a single message in the conversation
 * Memoized for performance optimization
 */
"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { ConversationMessage } from '@/stores/chat-store';

interface MessageBubbleProps {
  message: ConversationMessage;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * MessageBubble displays a single message with role-based styling
 *
 * @param message - The message to display
 * @param message.role - 'user' | 'assistant' | 'system'
 * @param message.content - The text content
 * @param message.streaming - Whether the message is currently streaming
 * @param message.toolCallName - Optional tool that was used
 *
 * @example
 * <MessageBubble
 *   message={{
 *     id: '1',
 *     role: 'user',
 *     content: 'Hello',
 *     createdAt: new Date()
 *   }}
 * />
 */
export const MessageBubble = React.memo(
  ({ message }: MessageBubbleProps) => {
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
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-wide">
          <span className="font-medium">
            {isUser ? "You" : isAssistant ? "YouWorker" : "System"}
          </span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
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
            <Loader2 className="h-3 w-3 animate-spin" />
            Streaming insight…
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if content or streaming status changed
    return (
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.streaming === nextProps.message.streaming &&
      prevProps.message.toolCallName === nextProps.message.toolCallName
    );
  }
);

MessageBubble.displayName = 'MessageBubble';
