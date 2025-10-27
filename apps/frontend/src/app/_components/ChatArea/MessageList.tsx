/**
 * MessageList component - displays all messages in the conversation
 * Handles auto-scrolling and empty states
 */
"use client";

import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { BrainCircuit, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationMessage } from '@/stores/chat-store';

interface MessageListProps {
  messages: ConversationMessage[];
  isStreaming: boolean;
  onNewSession?: () => void;
}

/**
 * MessageList renders a scrollable list of messages with auto-scroll
 *
 * @param messages - Array of conversation messages
 * @param isStreaming - Whether a message is currently streaming
 * @param onNewSession - Optional callback to start a new session
 *
 * @example
 * <MessageList
 *   messages={messages}
 *   isStreaming={isStreaming}
 *   onNewSession={startNewSession}
 * />
 */
export function MessageList({
  messages,
  isStreaming,
  onNewSession,
}: MessageListProps) {
  const messageListRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        ref={messageListRef}
        className="flex h-[calc(100vh-320px)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Welcome to YouWorker.AI
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Start a conversation with crimson-fueled intelligence. Ask questions, request
            research, orchestrate tool workflows, or ingest knowledge on the fly.
          </p>
          <div className="flex gap-2 text-sm">
            <Button variant="secondary" className="rounded-full">
              <Sparkles className="mr-2 h-4 w-4" /> Explore analytics
            </Button>
            {onNewSession && (
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={onNewSession}
              >
                <Plus className="mr-2 h-4 w-4" />
                Start fresh
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Message list
  return (
    <div
      ref={messageListRef}
      className="flex h-[calc(100vh-320px)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border/70 bg-background/70 p-6 shadow-inner"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
