import type { ChatStore } from "./chat-store";
import { useChatStore } from "./chat-store";

export const chatSelectors = {
  sessions: (state: ChatStore) => state.sessions,
  sessionsLoading: (state: ChatStore) => state.sessionsLoading,
  activeSession: (state: ChatStore) => state.activeSession,
  sessionIdentifier: (state: ChatStore) => state.sessionIdentifier,

  messages: (state: ChatStore) => state.messages,
  input: (state: ChatStore) => state.input,

  isStreaming: (state: ChatStore) => state.isStreaming,
  streamController: (state: ChatStore) => state.streamController,

  toolTimeline: (state: ChatStore) => state.toolTimeline,
  logEntries: (state: ChatStore) => state.logEntries,

  transcript: (state: ChatStore) => state.transcript,
  sttMeta: (state: ChatStore) => state.sttMeta,
  isRecording: (state: ChatStore) => state.isRecording,

  enableTools: (state: ChatStore) => state.enableTools,
  expectAudio: (state: ChatStore) => state.expectAudio,
  assistantLanguage: (state: ChatStore) => state.assistantLanguage,
  selectedModel: (state: ChatStore) => state.selectedModel,

  health: (state: ChatStore) => state.health,
  healthLoading: (state: ChatStore) => state.healthLoading,
} as const;

export const useChatSessions = () => useChatStore(chatSelectors.sessions);
export const useChatMessages = () => useChatStore(chatSelectors.messages);
export const useChatInput = () => useChatStore(chatSelectors.input);
export const useChatStreaming = () => useChatStore(chatSelectors.isStreaming);
