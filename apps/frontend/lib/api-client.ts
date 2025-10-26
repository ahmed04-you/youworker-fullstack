const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AnalyticsData {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  averageSessionLength: number;
  toolUsage: Record<string, number>;
}

class APIClient {
  private baseURL: string;
  private apiKey: string | null = null;

  constructor() {
    this.baseURL = API_URL;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    return headers;
  }

  async getSessions(): Promise<ChatSession[]> {
    const response = await fetch(`${this.baseURL}/sessions`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }
    
    return response.json();
  }

  async getSession(sessionId: string): Promise<ChatSession> {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch session');
    }
    
    return response.json();
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}/messages`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete session');
    }
  }

  async uploadDocument(file: File, collectionName?: string): Promise<{ document_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionName) {
      formData.append('collection_name', collectionName);
    }

    const response = await fetch(`${this.baseURL}/ingest/upload`, {
      method: 'POST',
      headers: {
        ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload document');
    }

    return response.json();
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const response = await fetch(`${this.baseURL}/analytics/overview`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseURL}/health`);
    
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    
    return response.json();
  }
}

export const apiClient = new APIClient();