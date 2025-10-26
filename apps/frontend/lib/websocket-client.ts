import { create } from 'zustand';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/ws';

export interface WSMessage {
  type: 'token' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool_name?: string;
  tool_args?: Record<string, any>;
  tool_result?: any;
  error?: string;
}

interface WebSocketStore {
  socket: WebSocket | null;
  isConnected: boolean;
  messages: WSMessage[];
  connect: (sessionId?: string) => void;
  disconnect: () => void;
  sendMessage: (content: string, sessionId?: string) => void;
  clearMessages: () => void;
}

export const useWebSocket = create<WebSocketStore>((set, get) => ({
  socket: null,
  isConnected: false,
  messages: [],

  connect: (sessionId?: string) => {
    const socket = new WebSocket(`${WS_URL}${sessionId ? `?session_id=${sessionId}` : ''}`);

    socket.onopen = () => {
      console.log('WebSocket connected');
      set({ socket, isConnected: true });
    };

    socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        set((state) => ({
          messages: [...state.messages, message],
        }));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      set({ socket: null, isConnected: false });
    };
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: (content: string, sessionId?: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        content,
        session_id: sessionId,
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  },
}));