import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatState } from '@/hooks/useChatState';
import type { SessionSummary, ChatToolEvent, ChatLogEntry } from '@/lib/types';

vi.mock('@/lib/types', () => ({
  SessionSummary: vi.fn(),
  ChatToolEvent: vi.fn(() => ({
    id: '',
    name: '',
    status: 'start',
    args: {},
    ts: '',
  })),
  ChatLogEntry: vi.fn(() => ({
    level: '',
    msg: '',
    assistant_language: '',
  })),
}));

describe('useChatState', () => {
  it('adds message correctly', () => {
    const { result } = renderHook(() => useChatState());
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'Hello',
      createdAt: new Date(),
    };
    act(() => {
      result.current.addMessage(message);
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello');
  });

  it('updates message content', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.addMessage({
        id: '1',
        role: 'user' as const,
        content: 'Initial',
        createdAt: new Date(),
      });
    });
    act(() => {
      result.current.updateMessage('1', 'Updated');
    });
    expect(result.current.messages[0].content).toBe('Updated');
  });

  it('sets input value', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.setInput('Test input');
    });
    expect(result.current.input).toBe('Test input');
  });

  it('toggles tools', () => {
    const { result } = renderHook(() => useChatState());
    expect(result.current.enableTools).toBe(true);
    act(() => {
      result.current.toggleTools(false);
    });
    expect(result.current.enableTools).toBe(false);
  });

  it('sets assistant language', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.setAssistantLanguage('fr');
    });
    expect(result.current.assistantLanguage).toBe('fr');
  });

  it('starts new session', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.startNewSession();
    });
    expect(result.current.messages.length).toBe(0);
    expect(result.current.input).toBe('');
  });

  it('adds tool event', () => {
    const { result } = renderHook(() => useChatState());
    const toolEvent: ChatToolEvent = {
      tool: 'web_search',
      status: 'start',
      args: { query: 'test' },
      ts: new Date().toISOString(),
    };
    act(() => {
      result.current.addToolEvent(toolEvent);
    });
    expect(result.current.toolTimeline).toHaveLength(1);
    expect(result.current.toolTimeline[0].tool).toBe('web_search');
  });

  it('adds log entry', () => {
    const { result } = renderHook(() => useChatState());
    const logEntry: ChatLogEntry = {
      level: 'info',
      msg: 'Test log',
      assistant_language: 'en',
    };
    act(() => {
      result.current.addLogEntry(logEntry);
    });
    expect(result.current.logEntries).toHaveLength(1);
    expect(result.current.logEntries[0].msg).toBe('Test log');
  });

  it('sets sessions', () => {
    const { result } = renderHook(() => useChatState());
    const sessions: SessionSummary[] = [
      { id: 1, external_id: 'sess1', title: 'Session 1', model: 'gpt-oss:20b', enable_tools: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    act(() => {
      result.current.setSessions(sessions);
    });
    expect(result.current.sessions).toEqual(sessions);
  });

  it('clears stream data', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.addToolEvent({} as ChatToolEvent);
      result.current.addLogEntry({} as ChatLogEntry);
      result.current.setTranscript('test', { confidence: 0.9 });
    });
    expect(result.current.toolTimeline.length).toBe(1);
    expect(result.current.logEntries.length).toBe(1);
    expect(result.current.transcript).toBe('test');
    act(() => {
      result.current.clearStreamData();
    });
    expect(result.current.toolTimeline.length).toBe(0);
    expect(result.current.logEntries.length).toBe(0);
    expect(result.current.transcript).toBeNull();
  });
});