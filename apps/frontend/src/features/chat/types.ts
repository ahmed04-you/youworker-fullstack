import type { SessionMessage, SessionSummary, ChatLogEntry, ChatToolEvent } from "@/lib/types";
import type { StreamController } from "@/lib/api-client";

export type ChatRole = SessionMessage["role"];

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  streaming?: boolean;
  toolCallName?: string | null;
}

export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  streaming?: boolean;
  toolCallName?: string | null;
}

export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
}

export interface SpeechTranscriptMeta {
  confidence?: number;
  language?: string;
}

export interface VoiceState {
  transcript: string | null;
  meta: SpeechTranscriptMeta;
  isRecording: boolean;
  audioContext: AudioContext | null;
  recordingStopResolver: (() => void) | null;
}

export interface ChatInsights {
  toolTimeline: ChatToolEvent[];
  logEntries: ChatLogEntry[];
}

export interface ChatConfigState {
  enableTools: boolean;
  expectAudio: boolean;
  assistantLanguage: string;
  selectedModel: string;
}

export interface HealthStatus {
  status: string;
  components?: {
    ollama?: {
      ready: boolean;
      missing: string[];
      models: Record<
        string,
        {
          name: string;
          available: boolean;
        }
      >;
    };
    agent?: string;
    voice?: {
      stt_available: boolean;
      tts_available: boolean;
    };
  };
}

export interface ChatSessionState {
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  activeSession: SessionSummary | null;
  sessionIdentifier: string;
}

export interface StreamingState {
  isStreaming: boolean;
  streamController: StreamController | null;
}
