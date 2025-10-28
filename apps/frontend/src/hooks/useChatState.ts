import { useReducer, useRef } from "react";
import { SessionSummary, ChatToolEvent, ChatLogEntry } from "@/lib/types";
import type { StreamController } from "@/lib/api-client";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  streaming?: boolean;
  toolCallName?: string | null;
}

interface SttMeta {
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

  // Stream state
  isStreaming: boolean;
  streamController: StreamController | null;
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];

  // Voice state
  transcript: string | null;
  sttMeta: SttMeta;
  isRecording: boolean;

  // UI state
  enableTools: boolean;
  expectAudio: boolean;
  assistantLanguage: string;
  selectedModel: string;
  health: any | null; // HealthStatus
  healthLoading: boolean;
}

type ChatAction =
  | { type: "SET_SESSIONS"; payload: SessionSummary[] }
  | { type: "SET_SESSIONS_LOADING"; payload: boolean }
  | { type: "SET_ACTIVE_SESSION"; payload: SessionSummary | null }
  | { type: "SET_SESSION_IDENTIFIER"; payload: string }
  | { type: "SET_MESSAGES"; payload: ConversationMessage[] }
  | { type: "ADD_MESSAGE"; payload: ConversationMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; content: string; streaming?: boolean } }
  | { type: "SET_INPUT"; payload: string }
  | { type: "SET_STREAMING"; payload: { isStreaming: boolean; controller?: StreamController | null } }
  | { type: "SET_TOOL_TIMELINE"; payload: ChatToolEvent[] }
  | { type: "SET_LOG_ENTRIES"; payload: ChatLogEntry[] }
  | { type: "ADD_TOOL_EVENT"; payload: ChatToolEvent }
  | { type: "ADD_LOG_ENTRY"; payload: ChatLogEntry }
  | { type: "SET_TRANSCRIPT"; payload: { transcript: string | null; sttMeta?: SttMeta } }
  | { type: "SET_RECORDING"; payload: boolean }
  | { type: "TOGGLE_TOOLS"; payload: boolean }
  | { type: "TOGGLE_AUDIO"; payload: boolean }
  | { type: "SET_ASSISTANT_LANGUAGE"; payload: string }
  | { type: "SET_SELECTED_MODEL"; payload: string }
  | { type: "SET_HEALTH"; payload: { health: any | null; loading: boolean } }
  | { type: "CLEAR_STREAM_DATA" };

const initialState: ChatState = {
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
  isRecording: false,

  enableTools: true,
  expectAudio: false,
  assistantLanguage: "en",
  selectedModel: "gpt-oss:20b",
  health: null,
  healthLoading: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_SESSIONS":
      return { ...state, sessions: action.payload };
    case "SET_SESSIONS_LOADING":
      return { ...state, sessionsLoading: action.payload };
    case "SET_ACTIVE_SESSION":
      return { ...state, activeSession: action.payload };
    case "SET_SESSION_IDENTIFIER":
      return { ...state, sessionIdentifier: action.payload };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? { ...msg, content: action.payload.content, streaming: action.payload.streaming }
            : msg
        ),
      };
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "SET_STREAMING":
      return {
        ...state,
        isStreaming: action.payload.isStreaming,
        streamController: action.payload.controller || null,
      };
    case "SET_TOOL_TIMELINE":
      return { ...state, toolTimeline: action.payload };
    case "SET_LOG_ENTRIES":
      return { ...state, logEntries: action.payload };
    case "ADD_TOOL_EVENT":
      return {
        ...state,
        toolTimeline: [...state.toolTimeline, action.payload].slice(-20),
      };
    case "ADD_LOG_ENTRY":
      return {
        ...state,
        logEntries: [...state.logEntries, action.payload].slice(-40),
      };
    case "SET_TRANSCRIPT":
      return {
        ...state,
        transcript: action.payload.transcript,
        sttMeta: action.payload.sttMeta || state.sttMeta,
      };
    case "SET_RECORDING":
      return { ...state, isRecording: action.payload };
    case "TOGGLE_TOOLS":
      return { ...state, enableTools: action.payload };
    case "TOGGLE_AUDIO":
      return { ...state, expectAudio: action.payload };
    case "SET_ASSISTANT_LANGUAGE":
      return { ...state, assistantLanguage: action.payload };
    case "SET_SELECTED_MODEL":
      return { ...state, selectedModel: action.payload };
    case "SET_HEALTH":
      return {
        ...state,
        health: action.payload.health,
        healthLoading: action.payload.loading,
      };
    case "CLEAR_STREAM_DATA":
      return {
        ...state,
        toolTimeline: [],
        logEntries: [],
        transcript: null,
        sttMeta: {},
      };
    default:
      return state;
  }
}

export function useChatState() {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStopResolver = useRef<(() => void) | null>(null);

  // Update ref
  const updateMessagesRef = (messages: ConversationMessage[]) => {
    messagesRef.current = messages;
  };

  // Actions
  const setSessions = (sessions: SessionSummary[]) => {
    dispatch({ type: "SET_SESSIONS", payload: sessions });
  };

  const setSessionsLoading = (loading: boolean) => {
    dispatch({ type: "SET_SESSIONS_LOADING", payload: loading });
  };

  const setActiveSession = (session: SessionSummary | null) => {
    dispatch({ type: "SET_ACTIVE_SESSION", payload: session });
  };

  const setSessionIdentifier = (id: string) => {
    dispatch({ type: "SET_SESSION_IDENTIFIER", payload: id });
  };

  const addMessage = (message: ConversationMessage) => {
    dispatch({ type: "ADD_MESSAGE", payload: message });
    updateMessagesRef([...state.messages, message]);
  };

  const updateMessage = (id: string, content: string, streaming?: boolean) => {
    dispatch({ type: "UPDATE_MESSAGE", payload: { id, content, streaming } });
    updateMessagesRef(
      state.messages.map((msg) =>
        msg.id === id ? { ...msg, content, streaming } : msg
      )
    );
  };

  const setMessages = (messages: ConversationMessage[]) => {
    dispatch({ type: "SET_MESSAGES", payload: messages });
    updateMessagesRef(messages);
  };

  const setInput = (input: string) => {
    dispatch({ type: "SET_INPUT", payload: input });
  };

  const setStreaming = (isStreaming: boolean, controller?: StreamController | null) => {
    dispatch({ type: "SET_STREAMING", payload: { isStreaming, controller } });
  };

  const setToolTimeline = (timeline: ChatToolEvent[]) => {
    dispatch({ type: "SET_TOOL_TIMELINE", payload: timeline });
  };

  const setLogEntries = (entries: ChatLogEntry[]) => {
    dispatch({ type: "SET_LOG_ENTRIES", payload: entries });
  };

  const addToolEvent = (event: ChatToolEvent) => {
    dispatch({ type: "ADD_TOOL_EVENT", payload: event });
  };

  const addLogEntry = (entry: ChatLogEntry) => {
    dispatch({ type: "ADD_LOG_ENTRY", payload: entry });
  };

  const setTranscript = (transcript: string | null, sttMeta?: SttMeta) => {
    dispatch({ type: "SET_TRANSCRIPT", payload: { transcript, sttMeta } });
  };

  const setRecording = (recording: boolean) => {
    dispatch({ type: "SET_RECORDING", payload: recording });
  };

  const toggleTools = (enable: boolean) => {
    dispatch({ type: "TOGGLE_TOOLS", payload: enable });
  };

  const toggleAudio = (expect: boolean) => {
    dispatch({ type: "TOGGLE_AUDIO", payload: expect });
  };

  const setAssistantLanguage = (lang: string) => {
    dispatch({ type: "SET_ASSISTANT_LANGUAGE", payload: lang });
  };

  const setSelectedModel = (model: string) => {
    dispatch({ type: "SET_SELECTED_MODEL", payload: model });
  };

  const setHealth = (health: any | null, loading: boolean) => {
    dispatch({ type: "SET_HEALTH", payload: { health, loading } });
  };

  const setStreamController = (controller: StreamController | null) => {
    dispatch({ type: "SET_STREAMING", payload: { isStreaming: !!controller, controller } });
  };

  const setIsStreaming = (isStreaming: boolean) => {
    if (!isStreaming) {
      dispatch({ type: "SET_STREAMING", payload: { isStreaming, controller: null } });
    } else {
      dispatch({ type: "SET_STREAMING", payload: { isStreaming, controller: state.streamController } });
    }
  };

  const setSttMeta = (meta: SttMeta) => {
    dispatch({ type: "SET_TRANSCRIPT", payload: { transcript: state.transcript, sttMeta: meta } });
  };

  const setIsRecording = (recording: boolean) => {
    dispatch({ type: "SET_RECORDING", payload: recording });
  };

  const setEnableTools = (enable: boolean) => {
    dispatch({ type: "TOGGLE_TOOLS", payload: enable });
  };

  const setExpectAudio = (expect: boolean) => {
    dispatch({ type: "TOGGLE_AUDIO", payload: expect });
  };

  const setHealthLoading = (loading: boolean) => {
    dispatch({ type: "SET_HEALTH", payload: { health: state.health, loading } });
  };

  const clearStreamData = () => {
    dispatch({ type: "CLEAR_STREAM_DATA" });
    updateMessagesRef(state.messages.filter((msg) => !msg.streaming));
  };

  const startNewSession = () => {
    const identifier = crypto.randomUUID();
    setActiveSession({
      id: -1,
      external_id: identifier,
      title: null,
      model: state.selectedModel,
      enable_tools: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSessionIdentifier(identifier);
    dispatch({ type: "SET_MESSAGES", payload: [] });
    dispatch({ type: "CLEAR_STREAM_DATA" });
    setInput("");
  };

  return {
    // State
    ...state,
    messagesRef,
    audioContextRef,
    recordingStopResolver,

    // Actions
    setSessions,
    setSessionsLoading,
    setActiveSession,
    setSessionIdentifier,
    setMessages,
    addMessage,
    updateMessage,
    setInput,
    setStreaming,
    setStreamController,
    setIsStreaming,
    setToolTimeline,
    setLogEntries,
    addToolEvent,
    addLogEntry,
    setTranscript,
    setSttMeta,
    setRecording,
    setIsRecording,
    toggleTools,
    setEnableTools,
    toggleAudio,
    setExpectAudio,
    setAssistantLanguage,
    setSelectedModel,
    setHealth,
    setHealthLoading,
    clearStreamData,
    startNewSession,
    updateMessagesRef,
  };
}
