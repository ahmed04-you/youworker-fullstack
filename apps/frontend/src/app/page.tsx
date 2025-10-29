"use client";

import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  AppShell,
  ConversationPane,
  InsightsPanel,
  MobileInsightsDrawer,
  useChatController,
} from "@/features/chat";

export default function ChatPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    messages,
    input,
    isStreaming,
    isRecording,
    selectedModel,
    enableTools,
    expectAudio,
    toolTimeline,
    logEntries,
    transcript,
    sttMeta,
    health,
    healthLoading,
    setInput,
    setSelectedModel,
    setEnableTools,
    setExpectAudio,
    refreshSessions,
    fetchHealth,
    stopStreaming,
    handleSendText,
    startRecording,
    stopRecording,
    startNewSession,
  } = useChatController();

  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const handleCloseKeyboard = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && typeof activeElement.blur === "function") {
      activeElement.blur();
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([refreshSessions(), fetchHealth()]);
  }, [fetchHealth, refreshSessions]);

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/70 px-8 py-12 text-center shadow-xl">
          <h1 className="text-2xl font-semibold text-foreground">
            Redirecting to authenticate…
          </h1>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        conversation={
          <ErrorBoundary>
            <ConversationPane
              messages={messages}
              isStreaming={isStreaming}
              isRecording={isRecording}
              input={input}
              selectedModel={selectedModel}
              enableTools={enableTools}
              expectAudio={expectAudio}
              onInputChange={setInput}
              onSendText={handleSendText}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onStopStreaming={stopStreaming}
              onToggleTools={() => setEnableTools(true)}
              onToggleAudio={() => setExpectAudio(!expectAudio)}
              onSelectedModelChange={setSelectedModel}
              onStartNewSession={startNewSession}
              onOpenSessions={() => setSessionDrawerOpen(true)}
              onOpenInsights={() => setInsightsOpen(true)}
              onCloseKeyboard={handleCloseKeyboard}
              onRefreshRequest={handleRefresh}
            />
          </ErrorBoundary>
        }
        insights={
          <InsightsPanel
            toolTimeline={toolTimeline}
            logEntries={logEntries}
            transcript={transcript}
            sttMeta={sttMeta}
            health={health}
            healthLoading={healthLoading}
            onRefreshHealth={fetchHealth}
          />
        }
      />
      <MobileInsightsDrawer
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        toolTimeline={toolTimeline}
        logEntries={logEntries}
        transcript={transcript}
        sttMeta={sttMeta}
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={fetchHealth}
      />
    </>
  );
}
