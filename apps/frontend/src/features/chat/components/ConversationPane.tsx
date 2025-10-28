"use client";

import { useMemo } from "react";
import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/useAutoScroll";

import type { ChatMessage, ChatMessageView } from "../types";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";

interface ConversationPaneProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isRecording: boolean;
  input: string;
  assistantLanguage: string;
  selectedModel: string;
  enableTools: boolean;
  expectAudio: boolean;
  onInputChange: (value: string) => void;
  onSendText: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopStreaming: () => void;
  onToggleTools: () => void;
  onToggleAudio: () => void;
  onAssistantLanguageChange: (value: string) => void;
  onSelectedModelChange: (value: string) => void;
  onStartNewSession: () => void;
}

export function ConversationPane({
  messages,
  isStreaming,
  isRecording,
  input,
  assistantLanguage,
  selectedModel,
  enableTools,
  expectAudio,
  onInputChange,
  onSendText,
  onStartRecording,
  onStopRecording,
  onStopStreaming,
  onToggleTools,
  onToggleAudio,
  onAssistantLanguageChange,
  onSelectedModelChange,
  onStartNewSession,
}: ConversationPaneProps) {
  const messageViews = useMemo<ChatMessageView[]>(
    () =>
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(message.createdAt),
        streaming: message.streaming,
        toolCallName: message.toolCallName,
      })),
    [messages]
  );

  const {
    scrollRef: messageListRef,
    hasNewMessages,
    scrollToBottom,
  } = useAutoScroll<HTMLDivElement>({
    enabled: true,
    threshold: 100,
  });

  const voiceSupported = useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    []
  );

  return (
    <div className="flex h-full flex-col">
      <MessageList
        ref={messageListRef}
        messages={messageViews}
        onStartNewSession={onStartNewSession}
      />

      {hasNewMessages && (
        <Button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
          size="sm"
        >
          <ArrowDown className="mr-2 h-4 w-4" />
          New messages
        </Button>
      )}

      <ChatComposer
        input={input}
        isStreaming={isStreaming}
        isRecording={isRecording}
        assistantLanguage={assistantLanguage}
        selectedModel={selectedModel}
        enableTools={enableTools}
        expectAudio={expectAudio}
        onInputChange={onInputChange}
        onSendText={onSendText}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onStopStreaming={onStopStreaming}
        onToggleTools={onToggleTools}
        onToggleAudio={onToggleAudio}
        onAssistantLanguageChange={onAssistantLanguageChange}
        onSelectedModelChange={onSelectedModelChange}
        voiceSupported={voiceSupported}
      />
    </div>
  );
}
