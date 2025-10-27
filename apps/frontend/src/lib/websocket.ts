"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  type: "text" | "audio" | "transcript" | "tool" | "status" | "error" | "system";
  content: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface WebSocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onText?: (content: string, metadata?: Record<string, any>) => void;
  onAudio?: (audioB64: string, sampleRate: number) => void;
  onTranscript?: (transcript: string, metadata?: Record<string, any>) => void;
  onTool?: (tool: string, metadata?: Record<string, any>) => void;
  onStatus?: (status: string, metadata?: Record<string, any>) => void;
  onError?: (error: string, metadata?: Record<string, any>) => void;
  onSystem?: (message: string) => void;
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: any[] = [];
  private callbacks: WebSocketCallbacks = {};
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(baseUrl: string) {
    this.url = baseUrl.replace(/^http/, 'ws');
  }

  setToken(token: string) {
    this.token = token;
  }

  setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(sessionId: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.sessionId = sessionId;
    this.isConnecting = true;
    this.reconnectAttempts = 0;

    const url = new URL(this.url);
    url.pathname = `/chat/${sessionId}`;
    if (this.token) {
      url.searchParams.append('token', this.token);
    }

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.flushQueue();
      this.callbacks.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.ws = null;
      this.callbacks.onDisconnect?.(event.code, event.reason);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.callbacks.onError?.('Connection error', {});
    };
  }

  private handleMessage(message: Message) {
    switch (message.type) {
      case "text":
        this.callbacks.onText?.(message.content, message.metadata);
        break;
      case "audio":
        this.callbacks.onAudio?.(message.content, message.metadata?.sample_rate || 22050);
        break;
      case "transcript":
        this.callbacks.onTranscript?.(message.content, message.metadata);
        break;
      case "tool":
        this.callbacks.onTool?.(message.content, message.metadata);
        break;
      case "status":
        this.callbacks.onStatus?.(message.content, message.metadata);
        break;
      case "error":
        this.callbacks.onError?.(message.content, message.metadata);
        break;
      case "system":
        this.callbacks.onSystem?.(message.content);
        break;
    }
  }

  sendTextMessage(content: string) {
    this.sendMessage({ type: "text", content, timestamp: new Date().toISOString() });
  }

  sendAudioMessage(audioB64: string, sampleRate: number) {
    this.sendMessage({
      type: "audio",
      audio_data: audioB64,
      sample_rate: sampleRate,
      metadata: { expect_audio: true },
      timestamp: new Date().toISOString()
    });
  }

  sendStop() {
    this.sendMessage({ type: "stop", timestamp: new Date().toISOString() });
  }

  sendPing() {
    this.sendMessage({ type: "ping", timestamp: new Date().toISOString() });
  }

  private sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.sessionId) {
      this.reconnectAttempts++;
      this.reconnectTimeout = setTimeout(() => this.connect(this.sessionId!), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close(1000, "User disconnect");
    this.messageQueue = [];
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Custom hook for using WebSocket in components
export function useWebSocket(baseUrl: string, sessionId: string, token: string | null) {
  const wsRef = useRef<ChatWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !baseUrl) return;

    wsRef.current = new ChatWebSocket(baseUrl);
    wsRef.current.setToken(token || '');

    wsRef.current.setCallbacks({
      onConnect: () => setIsConnected(true),
      onDisconnect: () => setIsConnected(false),
    });

    wsRef.current.connect(sessionId);

    return () => {
      wsRef.current?.disconnect();
    };
  }, [baseUrl, sessionId, token]);

  return {
    ws: wsRef.current,
    isConnected,
    sendText: (content: string) => wsRef.current?.sendTextMessage(content),
    sendAudio: (audioB64: string, sampleRate: number) => wsRef.current?.sendAudioMessage(audioB64, sampleRate),
  };
}