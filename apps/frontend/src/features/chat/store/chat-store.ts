"use client";

import { create } from "zustand";

import type { StreamController } from "@/lib/api-client";
import type { ChatLogEntry, ChatToolEvent, SessionSummary } from "@/lib/types";
import type {
  ChatHistoryItem,
  ChatMessage,
  HealthStatus,
  SpeechTranscriptMeta,
} from "../types";

const DEFAULT_MODEL = "gpt-oss:20b";
const DEFAULT_LANGUAGE = "auto";
const MAX_HISTORY = 6_000;

type MessageUpdater =
  | Partial<ChatMessage>
  | ((current: ChatMessage) => ChatMessage);

const generateIdentifier = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

export interface ChatStoreState {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  sessionIdentifier: string;

  messages: ChatMessage[];
  input: string;

  isStreaming: boolean;
  streamController: StreamController | null;

  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];

  transcript: string | null;
  sttMeta: SpeechTranscriptMeta;
  isRecording: boolean;
  audioContext: AudioContext | null;
  recordingStopResolver: (() => void) | null;

  enableTools: boolean;
  expectAudio: boolean;
  assistantLanguage: string;
  selectedModel: string;

  health: HealthStatus | null;
  healthLoading: boolean;
}

export interface ChatStoreActions {
  setSessions: (sessions: SessionSummary[]) => void;
  setSessionsLoading: (loading: boolean) => void;
  setActiveSession: (session: SessionSummary | null) => void;
  setSessionIdentifier: (identifier: string) => void;

  setMessages: (
    messages:
      | ChatMessage[]
      | ((current: ChatMessage[]) => ChatMessage[])
  ) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updater: MessageUpdater) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;

  setInput: (value: string) => void;

  setIsStreaming: (streaming: boolean) => void;
  setStreamController: (controller: StreamController | null) => void;

  setToolTimeline: (
    events: ChatToolEvent[] | ((current: ChatToolEvent[]) => ChatToolEvent[])
  ) => void;
  addToolEvent: (event: ChatToolEvent) => void;
  clearToolTimeline: () => void;

  setLogEntries: (
    entries: ChatLogEntry[] | ((current: ChatLogEntry[]) => ChatLogEntry[])
  ) => void;
  addLogEntry: (entry: ChatLogEntry) => void;
  clearLogEntries: () => void;

  setTranscript: (transcript: string | null, meta?: SpeechTranscriptMeta) => void;
  setSttMeta: (meta: SpeechTranscriptMeta) => void;
  setIsRecording: (recording: boolean) => void;
  setAudioContext: (context: AudioContext | null) => void;
  setRecordingStopResolver: (resolver: (() => void) | null) => void;

  setEnableTools: (enabled: boolean) => void;
  toggleEnableTools: () => void;
  setExpectAudio: (expect: boolean) => void;
  toggleExpectAudio: () => void;
  setAssistantLanguage: (language: string) => void;
  setSelectedModel: (model: string) => void;

  setHealth: (health: HealthStatus | null) => void;
  setHealthLoading: (loading: boolean) => void;

  clearStreamData: () => void;
  startNewSession: (overrides?: Partial<SessionSummary>) => void;

  getSessionHistory: () => ChatHistoryItem[];
  deriveSessionName: (session: SessionSummary | null) => string;
  hasPersistedSession: () => boolean;
}

export type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  activeSession: null,
  sessionIdentifier: generateIdentifier(),

  messages: [],
  input: "",

  isStreaming: false,
  streamController: null,

  toolTimeline: [],
  logEntries: [],

  transcript: null,
  sttMeta: {},
  isRecording: false,
  audioContext: null,
  recordingStopResolver: null,

  enableTools: true,
  expectAudio: false,
  assistantLanguage: DEFAULT_LANGUAGE,
  selectedModel: DEFAULT_MODEL,

  health: null,
  healthLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setSessionsLoading: (sessionsLoading) => set({ sessionsLoading }),
  setActiveSession: (activeSession) => set({ activeSession }),
  setSessionIdentifier: (sessionIdentifier) => set({ sessionIdentifier }),

  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function" ? messages(state.messages) : messages,
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateMessage: (id, updater) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== id) {
          return message;
        }
        if (typeof updater === "function") {
          return updater(message);
        }
        return {
          ...message,
          ...updater,
        };
      }),
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== id),
    })),
  clearMessages: () => set({ messages: [] }),

  setInput: (input) => set({ input }),

  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamController: (streamController) => set({ streamController }),

  setToolTimeline: (events) =>
    set((state) => ({
      toolTimeline:
        typeof events === "function" ? events(state.toolTimeline) : events,
    })),
  addToolEvent: (event) =>
    set((state) => ({
      toolTimeline: [...state.toolTimeline, event].slice(-20),
    })),
  clearToolTimeline: () => set({ toolTimeline: [] }),

  setLogEntries: (entries) =>
    set((state) => ({
      logEntries:
        typeof entries === "function" ? entries(state.logEntries) : entries,
    })),
  addLogEntry: (entry) =>
    set((state) => ({
      logEntries: [...state.logEntries, entry].slice(-40),
    })),
  clearLogEntries: () => set({ logEntries: [] }),

  setTranscript: (transcript, meta) =>
    set((state) => ({
      transcript,
      sttMeta: meta ? meta : state.sttMeta,
    })),
  setSttMeta: (meta) => set({ sttMeta: meta }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setAudioContext: (audioContext) => set({ audioContext }),
  setRecordingStopResolver: (recordingStopResolver) =>
    set({ recordingStopResolver }),

  setEnableTools: (enableTools) => set({ enableTools }),
  toggleEnableTools: () =>
    set((state) => ({ enableTools: !state.enableTools })),
  setExpectAudio: (expectAudio) => set({ expectAudio }),
  toggleExpectAudio: () =>
    set((state) => ({ expectAudio: !state.expectAudio })),
  setAssistantLanguage: (assistantLanguage) => set({ assistantLanguage }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  setHealth: (health) => set({ health }),
  setHealthLoading: (healthLoading) => set({ healthLoading }),

  clearStreamData: () =>
    set({
      // toolTimeline persists across messages in the same session
      // It will be cleared only when starting a new session
      logEntries: [],
      transcript: null,
      sttMeta: {},
    }),

  startNewSession: (overrides) => {
    const identifier = generateIdentifier();
    const now = new Date().toISOString();
    const currentModel = get().selectedModel;
    const nextSession: SessionSummary = {
      id: -1,
      external_id: identifier,
      title: null,
      model: currentModel,
      enable_tools: true,
      created_at: now,
      updated_at: now,
      ...overrides,
    };

    set({
      activeSession: nextSession,
      sessionIdentifier: identifier,
      messages: [],
      input: "",
      toolTimeline: [], // Clear tools when starting new session
    });

    get().clearStreamData();
  },

  getSessionHistory: () => {
    const { messages } = get();
    return messages
      .filter((message) => message.role !== "system" && !message.streaming)
      .map<ChatHistoryItem>(({ role, content }) => ({ role, content }))
      .slice(-MAX_HISTORY);
  },

  deriveSessionName: (session) => {
    if (!session) {
      return "New Conversation";
    }
    if (session.title) {
      return session.title;
    }
    if (session.external_id) {
      return session.external_id.slice(0, 8);
    }
    return `Session #${session.id}`;
  },

  hasPersistedSession: () => {
    const session = get().activeSession;
    return Boolean(session && session.id > 0);
  },
}));
