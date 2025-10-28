"use client";

import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  AppShell,
  ChatHeader,
  ConversationPane,
  InsightsPanel,
  MobileInsightsDrawer,
  SessionSidebar,
  useChatController,
} from "@/features/chat";

export default function ChatPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    sessions,
    sessionsLoading,
    activeSession,
    messages,
    input,
    isStreaming,
    isRecording,
    assistantLanguage,
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
    setAssistantLanguage,
    setSelectedModel,
    setEnableTools,
    setExpectAudio,
    refreshSessions,
    fetchHealth,
    handleSelectSession,
    handleDeleteSession,
    renameSession,
    stopStreaming,
    handleSendText,
    startRecording,
    stopRecording,
    startNewSession,
    deriveSessionName,
  } = useChatController();

  const [insightsOpen, setInsightsOpen] = useState(false);

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
        sidebar={
          <SessionSidebar
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeSession={activeSession}
            onRefresh={refreshSessions}
            onNewSession={startNewSession}
            onSelectSession={handleSelectSession}
            onRenameSession={renameSession}
            onDeleteSession={handleDeleteSession}
            deriveSessionName={deriveSessionName}
          />
        }
        header={
          <ChatHeader
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeSession={activeSession}
            onRefreshSessions={refreshSessions}
            onNewSession={startNewSession}
            onSelectSession={handleSelectSession}
            onRenameSession={renameSession}
            onDeleteSession={handleDeleteSession}
            onRefreshHealth={fetchHealth}
            healthLoading={healthLoading}
            isStreaming={isStreaming}
            enableTools={enableTools}
            deriveSessionName={deriveSessionName}
            onOpenInsights={() => setInsightsOpen(true)}
          />
        }
        conversation={
          <ConversationPane
            messages={messages}
            isStreaming={isStreaming}
            isRecording={isRecording}
            input={input}
            assistantLanguage={assistantLanguage}
            selectedModel={selectedModel}
            enableTools={enableTools}
            expectAudio={expectAudio}
            onInputChange={setInput}
            onSendText={handleSendText}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onStopStreaming={stopStreaming}
            onToggleTools={() => setEnableTools(!enableTools)}
            onToggleAudio={() => setExpectAudio(!expectAudio)}
            onAssistantLanguageChange={setAssistantLanguage}
            onSelectedModelChange={setSelectedModel}
            onStartNewSession={startNewSession}
          />
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
