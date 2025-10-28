"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, PanInfo } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

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
  onOpenSessions?: () => void;
  onOpenInsights?: () => void;
  onCloseKeyboard?: () => void;
  onRefreshRequest?: () => void | Promise<void>;
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
  onOpenSessions,
  onOpenInsights,
  onCloseKeyboard,
  onRefreshRequest,
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

  const [isMobile, setIsMobile] = useState(false);
  const refreshInProgressRef = useRef(false);
  const gestureHaptic = useHapticFeedback({ pattern: [10, 40, 10] });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateDeviceState = () => {
      const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      setIsMobile(coarsePointer || window.innerWidth < 1024);
    };

    updateDeviceState();
    window.addEventListener("resize", updateDeviceState);
    return () => window.removeEventListener("resize", updateDeviceState);
  }, []);

  const handlePanEnd = useCallback(
    async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isMobile) {
        return;
      }

      const horizontalMomentum = info.offset.x + info.velocity.x * 120;
      const verticalMomentum = info.offset.y + info.velocity.y * 140;

      const absHorizontal = Math.abs(horizontalMomentum);
      const absVertical = Math.abs(verticalMomentum);

      const horizontalThreshold = 80;
      const closeKeyboardThreshold = 60;
      const refreshThreshold = 150;

      if (absHorizontal > absVertical && absHorizontal > horizontalThreshold) {
        if (horizontalMomentum > 0) {
          if (onOpenSessions) {
            gestureHaptic();
            onOpenSessions();
          }
        } else if (onOpenInsights) {
          gestureHaptic();
          onOpenInsights();
        }
        return;
      }

      if (verticalMomentum > refreshThreshold) {
        if (!refreshInProgressRef.current) {
          refreshInProgressRef.current = true;
          gestureHaptic([15, 60, 15]);
          try {
            await Promise.resolve(onRefreshRequest?.());
          } finally {
            refreshInProgressRef.current = false;
          }
        }
        onCloseKeyboard?.();
        return;
      }

      if (verticalMomentum > closeKeyboardThreshold) {
        if (onCloseKeyboard) {
          gestureHaptic();
          onCloseKeyboard();
        }
      }
    },
    [gestureHaptic, isMobile, onCloseKeyboard, onOpenInsights, onOpenSessions, onRefreshRequest]
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
    <motion.div
      className="relative flex h-full flex-col"
      onPanEnd={isMobile ? handlePanEnd : undefined}
    >
      {/* Streaming indicator badge */}
      {isStreaming && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <Badge
            variant="default"
            className="animate-pulse shadow-lg"
            aria-live="polite"
            aria-label="AI is responding"
          >
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            AI Responding...
          </Badge>
        </div>
      )}

      <MessageList
        ref={messageListRef}
        messages={messageViews}
        onStartNewSession={onStartNewSession}
        onSamplePromptClick={onInputChange}
      />

      {hasNewMessages && (
        <Button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-10"
          size="sm"
        >
          <ArrowDown className="mr-2 h-4 w-4" />
          New messages
        </Button>
      )}

      {/* Sticky compose bar on mobile, relative on desktop */}
      <div className="md:relative md:mt-6 fixed bottom-0 left-0 right-0 md:left-auto md:right-auto md:bottom-auto bg-background md:bg-transparent p-4 md:p-0 border-t md:border-t-0 z-20">
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

      {/* Spacer for mobile to prevent content from being hidden behind sticky composer */}
      <div className="md:hidden h-[200px]" aria-hidden="true" />
    </motion.div>
  );
}
