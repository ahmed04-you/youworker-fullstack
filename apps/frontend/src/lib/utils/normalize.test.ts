/**
 * Tests for normalization utilities
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeToolEvents,
  normalizeLogEntries,
  normalizeArray,
  getTokenText,
} from './normalize';

describe('getTokenText', () => {
  it('should return string directly', () => {
    expect(getTokenText('hello')).toBe('hello');
  });

  it('should extract text property from object', () => {
    expect(getTokenText({ text: 'world' })).toBe('world');
  });

  it('should return empty string for non-string text property', () => {
    expect(getTokenText({ text: 123 })).toBe('');
  });

  it('should return empty string for null', () => {
    expect(getTokenText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(getTokenText(undefined)).toBe('');
  });
});

describe('normalizeToolEvents', () => {
  it('should normalize valid tool events', () => {
    const input = [
      { tool: 'search', status: 'success', latency_ms: 150 },
      { tool: 'calculator', status: 'start' },
    ];

    const result = normalizeToolEvents(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      tool: 'search',
      status: 'success',
      latency_ms: 150,
    });
    expect(result[1]).toEqual({
      tool: 'calculator',
      status: 'start',
    });
  });

  it('should filter out invalid entries', () => {
    const input = [
      { tool: 'search', status: 'success' },
      { tool: 'invalid' }, // missing status
      { status: 'success' }, // missing tool
      null,
      'invalid',
    ];

    const result = normalizeToolEvents(input);

    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe('search');
  });

  it('should return empty array for non-array input', () => {
    expect(normalizeToolEvents(null)).toEqual([]);
    expect(normalizeToolEvents(undefined)).toEqual([]);
    expect(normalizeToolEvents('not an array')).toEqual([]);
  });

  it('should handle optional fields', () => {
    const input = [
      {
        tool: 'search',
        status: 'success',
        latency_ms: 100,
        result_preview: 'Found 5 results',
        ts: '2024-01-01T00:00:00Z',
        args: { query: 'test' },
      },
    ];

    const result = normalizeToolEvents(input);

    expect(result[0]).toEqual({
      tool: 'search',
      status: 'success',
      latency_ms: 100,
      result_preview: 'Found 5 results',
      ts: '2024-01-01T00:00:00Z',
      args: { query: 'test' },
    });
  });
});

describe('normalizeLogEntries', () => {
  it('should normalize valid log entries', () => {
    const input = [
      { level: 'info', msg: 'Starting process' },
      { level: 'error', msg: 'Failed to connect', assistant_language: 'en' },
    ];

    const result = normalizeLogEntries(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      level: 'info',
      msg: 'Starting process',
    });
    expect(result[1]).toEqual({
      level: 'error',
      msg: 'Failed to connect',
      assistant_language: 'en',
    });
  });

  it('should filter out invalid entries', () => {
    const input = [
      { level: 'info', msg: 'Valid' },
      { level: 'info' }, // missing msg
      { msg: 'Invalid' }, // missing level
      null,
    ];

    const result = normalizeLogEntries(input);

    expect(result).toHaveLength(1);
    expect(result[0].msg).toBe('Valid');
  });

  it('should return empty array for non-array input', () => {
    expect(normalizeLogEntries(null)).toEqual([]);
    expect(normalizeLogEntries({})).toEqual([]);
  });
});

describe('normalizeArray', () => {
  it('should apply validator function to each item', () => {
    const input = [1, 2, 3, 4, 5];
    const validator = (item: unknown) => {
      if (typeof item === 'number' && item % 2 === 0) {
        return item * 2;
      }
      return null;
    };

    const result = normalizeArray(input, validator);

    expect(result).toEqual([4, 8]); // 2*2=4, 4*2=8
  });

  it('should return empty array for non-array input', () => {
    const validator = (item: unknown) => item;
    expect(normalizeArray(null, validator)).toEqual([]);
    expect(normalizeArray('not array', validator)).toEqual([]);
  });

  it('should filter out null results', () => {
    const input = [1, 2, 3];
    const validator = (item: unknown) => {
      if (item === 2) return null;
      return item;
    };

    const result = normalizeArray(input, validator);

    expect(result).toEqual([1, 3]);
  });
});
