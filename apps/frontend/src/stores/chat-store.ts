/**
 * Zustand store for chat state management
 * Replaces 40+ useState hooks with centralized state
 */
import { create } from 'zustand';
import { SessionSummary, ChatToolEvent, ChatLogEntry } from '@/lib/types';
import { StreamController } from '@/lib/api-client';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  streaming?: boolean;
  toolCallName?: string | null;
}

interface SpeechTranscriptMeta {
  confidence?: number;
  language?: string;
}

interface ChatState {
  // Session state
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  sessionIdentifier: string;

  // Message state
  messages: ConversationMessage[];
  input: string;
  isStreaming: boolean;
  streamController: StreamController | null;

  // Insight state
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];
  transcript: string | null;
  sttMeta: SpeechTranscriptMeta;

  // Configuration state
  enableTools: boolean;
  expectAudio: boolean;
  assistantLanguage: string;
  selectedModel: string;

  // Voice recording state
  isRecording: boolean;

  // Actions
  setSessions: (sessions: SessionSummary[]) => void;
  setSessionsLoading: (loading: boolean) => void;
  setActiveSession: (session: SessionSummary | null) => void;
  setSessionIdentifier: (id: string) => void;

  setMessages: (messages: ConversationMessage[] | ((prev: ConversationMessage[]) => ConversationMessage[])) => void;
  addMessage: (message: ConversationMessage) => void;
  updateMessage: (id: string, updates: Partial<ConversationMessage>) => void;
  clearMessages: () => void;

  setInput: (input: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamController: (controller: StreamController | null) => void;

  setToolTimeline: (events: ChatToolEvent[] | ((prev: ChatToolEvent[]) => ChatToolEvent[])) => void;
  addToolEvent: (event: ChatToolEvent) => void;

  setLogEntries: (logs: ChatLogEntry[] | ((prev: ChatLogEntry[]) => ChatLogEntry[])) => void;
  addLogEntry: (log: ChatLogEntry) => void;

  setTranscript: (transcript: string | null) => void;
  setSttMeta: (meta: SpeechTranscriptMeta) => void;

  setEnableTools: (enable: boolean) => void;
  toggleEnableTools: () => void;
  setExpectAudio: (expect: boolean) => void;
  toggleExpectAudio: () => void;
  setAssistantLanguage: (lang: string) => void;
  setSelectedModel: (model: string) => void;

  setIsRecording: (recording: boolean) => void;

  // Complex actions
  startNewSession: () => void;
  resetInsights: () => void;
}

const DEFAULT_MODEL = "gpt-oss:20b";
const DEFAULT_LANGUAGE = "en";

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  sessions: [],
  sessionsLoading: false,
  activeSession: null,
  sessionIdentifier: crypto.randomUUID(),

  messages: [],
  input: "",
  isStreaming: false,
  streamController: null,

  toolTimeline: [],
  logEntries: [],
  transcript: null,
  sttMeta: {},

  enableTools: true,
  expectAudio: false,
  assistantLanguage: DEFAULT_LANGUAGE,
  selectedModel: DEFAULT_MODEL,

  isRecording: false,

  // Session actions
  setSessions: (sessions) => set({ sessions }),
  setSessionsLoading: (loading) => set({ sessionsLoading: loading }),
  setActiveSession: (session) => set({ activeSession: session }),
  setSessionIdentifier: (id) => set({ sessionIdentifier: id }),

  // Message actions
  setMessages: (messages) =>
    set((state) => ({
      messages: typeof messages === 'function' ? messages(state.messages) : messages,
    })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  // Input actions
  setInput: (input) => set({ input }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamController: (controller) => set({ streamController: controller }),

  // Tool timeline actions
  setToolTimeline: (events) =>
    set((state) => ({
      toolTimeline: typeof events === 'function' ? events(state.toolTimeline) : events,
    })),
  addToolEvent: (event) =>
    set((state) => ({
      toolTimeline: [...state.toolTimeline, event].slice(-20),
    })),

  // Log entry actions
  setLogEntries: (logs) =>
    set((state) => ({
      logEntries: typeof logs === 'function' ? logs(state.logEntries) : logs,
    })),
  addLogEntry: (log) =>
    set((state) => ({
      logEntries: [...state.logEntries, log].slice(-40),
    })),

  // Transcript actions
  setTranscript: (transcript) => set({ transcript }),
  setSttMeta: (meta) => set({ sttMeta: meta }),

  // Configuration actions
  setEnableTools: (enable) => set({ enableTools: enable }),
  toggleEnableTools: () => set((state) => ({ enableTools: !state.enableTools })),
  setExpectAudio: (expect) => set({ expectAudio: expect }),
  toggleExpectAudio: () => set((state) => ({ expectAudio: !state.expectAudio })),
  setAssistantLanguage: (lang) => set({ assistantLanguage: lang }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  // Recording actions
  setIsRecording: (recording) => set({ isRecording: recording }),

  // Complex actions
  startNewSession: () => {
    const identifier = crypto.randomUUID();
    set({
      activeSession: {
        id: -1,
        external_id: identifier,
        title: null,
        model: null,
        enable_tools: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      sessionIdentifier: identifier,
      messages: [],
      toolTimeline: [],
      logEntries: [],
      transcript: null,
    });
  },

  resetInsights: () =>
    set({
      toolTimeline: [],
      logEntries: [],
      transcript: null,
      sttMeta: {},
    }),
}));
