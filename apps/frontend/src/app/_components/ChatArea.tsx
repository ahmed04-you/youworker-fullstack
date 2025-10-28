"use client";

import { useChatStore } from "@/stores/chat-store";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageList } from "./MessageList";
import { ChatComposer } from "../ChatComposer";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { ConversationMessage } from "@/lib/types";

interface ChatAreaProps {
  onNewSession?: () => void;
  sessionsLoading: boolean;
  activeSession: any; // SessionSummary | null
  onSelectSession: (session: any) => void;
  onRenameSession: (session: any) => void;
  onDeleteSession: (session: any) => void;
  sessions: any[];
}

export function ChatArea({
  onNewSession,
  sessionsLoading,
  activeSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  sessions,
}: ChatAreaProps) {
  const {
    messages,
    input,
    isStreaming,
    enableTools,
    expectAudio,
    assistantLanguage,
    selectedModel,
    isRecording,
    transcript,
    sttMeta,
    toolTimeline,
    logEntries,
    health,
    healthLoading,
  } = useChatStore();

  const setInput = useChatStore((state) => state.setInput);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setIsStreaming = useChatStore((state) => state.setIsStreaming);
  const setIsRecording = useChatStore((state) => state.setIsRecording);
  const setEnableTools = useChatStore((state) => state.setEnableTools);
  const setExpectAudio = useChatStore((state) => state.setExpectAudio);
  const setAssistantLanguage = useChatStore((state) => state.setAssistantLanguage);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const addToolEvent = useChatStore((state) => state.addToolEvent);
  const addLogEntry = useChatStore((state) => state.addLogEntry);
  const setTranscript = useChatStore((state) => state.setTranscript);
  const setSttMeta = useChatStore((state) => state.setSttMeta);
  const clearStreamData = useChatStore((state) => state.clearStreamData);
  const startNewSession = useChatStore((state) => state.startNewSession);
  const fetchHealth = useChatStore((state) => state.fetchHealth);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const handleSendText = useChatStore((state) => state.handleSendText);
  const startRecording = useChatStore((state) => state.startRecording);
  const stopRecording = useChatStore((state) => state.stopRecording);

  const { scrollRef: messageListRef, hasNewMessages, scrollToBottom } = useAutoScroll<HTMLDivElement>({
    enabled: true,
    threshold: 100,
  });

  // Note: The actual logic for handleSendText, etc., should be in the store or a custom hook.
  // For now, assuming the store has actions, but from original, logic is in component.
  // To reduce bloat, we need to move logic to hooks or store actions.

  return (
    <section className="flex-1 relative" aria-label="Chat area">
      <MessageList
        ref={messageListRef}
        messages={messages}
        isStreaming={isStreaming}
        onNewSession={onNewSession}
      />
      {hasNewMessages && (
        <Button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-10"
          size="sm"
          aria-label="Scroll to new messages"
        >
          <ArrowDown className="h-4 w-4" />
          New messages
        </Button>
      )}
      <ChatComposer
        input={input}
        onInputChange={setInput}
        onSendText={handleSendText}
        isStreaming={isStreaming}
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onStopStreaming={stopStreaming}
        assistantLanguage={assistantLanguage}
        onAssistantLanguageChange={setAssistantLanguage}
        selectedModel={selectedModel}
        onSelectedModelChange={setSelectedModel}
        enableTools={enableTools}
        onToggleTools={() => setEnableTools(!enableTools)}
        expectAudio={expectAudio}
        onToggleAudio={() => setExpectAudio(!expectAudio)}
      />
    </section>
  );
}
