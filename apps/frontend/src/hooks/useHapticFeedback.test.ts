import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useHapticFeedback } from './useHapticFeedback';

describe('useHapticFeedback', () => {
  let navigatorSpy: any;
  let matchMediaSpy: any;

  beforeEach(() => {
    // Mock navigator.vibrate
    navigatorSpy = vi.spyOn(navigator, 'vibrate' as any).mockImplementation(() => true);

    // Mock window.matchMedia
    matchMediaSpy = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaSpy,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature Detection', () => {
    it('should return a function', async () => {
      const { result } = renderHook(() => useHapticFeedback());
      await waitFor(() => {
        expect(typeof result.current).toBe('function');
      });
    });

    it('should support haptic feedback on touch devices without reduced motion', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        if (query === '(prefers-reduced-motion: reduce)') {
          return { matches: false };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(true);
        expect(navigatorSpy).toHaveBeenCalled();
      });
    });

    it('should not trigger haptic on non-touch devices', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: false };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
        expect(navigatorSpy).not.toHaveBeenCalled();
      });
    });

    it('should respect prefers-reduced-motion', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        if (query === '(prefers-reduced-motion: reduce)') {
          return { matches: true };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
        expect(navigatorSpy).not.toHaveBeenCalled();
      });
    });

    it('should handle missing vibrate API', async () => {
      // Remove vibrate from navigator
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: undefined,
      });

      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
      });
    });
  });

  describe('Pattern Support', () => {
    beforeEach(() => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });
    });

    it('should use default pattern when none provided', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        result.current();
        expect(navigatorSpy).toHaveBeenCalledWith(10);
      });
    });

    it('should use custom pattern from options', async () => {
      const { result } = renderHook(() => useHapticFeedback({ pattern: 50 }));

      await waitFor(() => {
        result.current();
        expect(navigatorSpy).toHaveBeenCalledWith(50);
      });
    });

    it('should accept array pattern', async () => {
      const { result } = renderHook(() => useHapticFeedback({ pattern: [10, 50, 10] }));

      await waitFor(() => {
        result.current();
        expect(navigatorSpy).toHaveBeenCalledWith([10, 50, 10]);
      });
    });

    it('should allow custom pattern override at call time', async () => {
      const { result } = renderHook(() => useHapticFeedback({ pattern: 10 }));

      await waitFor(() => {
        result.current(100);
        expect(navigatorSpy).toHaveBeenCalledWith(100);
      });
    });

    it('should allow custom array pattern override at call time', async () => {
      const { result } = renderHook(() => useHapticFeedback({ pattern: 10 }));

      await waitFor(() => {
        result.current([20, 40, 20]);
        expect(navigatorSpy).toHaveBeenCalledWith([20, 40, 20]);
      });
    });

    it('should update pattern when options change', async () => {
      const { result, rerender } = renderHook(
        ({ pattern }) => useHapticFeedback({ pattern }),
        { initialProps: { pattern: 10 } }
      );

      await waitFor(() => {
        result.current();
        expect(navigatorSpy).toHaveBeenCalledWith(10);
      });

      // Update pattern
      act(() => {
        rerender({ pattern: 50 });
      });

      await waitFor(() => {
        result.current();
        expect(navigatorSpy).toHaveBeenCalledWith(50);
      });
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should be enabled by default', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(true);
        expect(navigatorSpy).toHaveBeenCalled();
      });
    });

    it('should not trigger when disabled', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });

      const { result } = renderHook(() => useHapticFeedback({ enabled: false }));

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
        expect(navigatorSpy).not.toHaveBeenCalled();
      });
    });

    it('should update support when enabled changes', async () => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });

      const { result, rerender } = renderHook(
        ({ enabled }) => useHapticFeedback({ enabled }),
        { initialProps: { enabled: false } }
      );

      // Initially disabled
      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
      });

      // Enable it
      act(() => {
        rerender({ enabled: true });
      });

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(true);
        expect(navigatorSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });
    });

    it('should handle vibrate API errors gracefully', async () => {
      navigatorSpy.mockImplementation(() => {
        throw new Error('Vibrate failed');
      });

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
      });
    });

    it('should return false when vibrate returns false', async () => {
      navigatorSpy.mockImplementation(() => false);

      const { result } = renderHook(() => useHapticFeedback());

      await waitFor(() => {
        const success = result.current();
        expect(success).toBe(false);
      });
    });
  });

  describe('Multiple Calls', () => {
    beforeEach(() => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });
    });

    it('should allow multiple haptic triggers', async () => {
      const { result } = renderHook(() => useHapticFeedback({ pattern: 10 }));

      await waitFor(() => {
        result.current();
        result.current(20);
        result.current([10, 20, 10]);

        expect(navigatorSpy).toHaveBeenCalledTimes(3);
        expect(navigatorSpy).toHaveBeenNthCalledWith(1, 10);
        expect(navigatorSpy).toHaveBeenNthCalledWith(2, 20);
        expect(navigatorSpy).toHaveBeenNthCalledWith(3, [10, 20, 10]);
      });
    });
  });

  describe('Memoization', () => {
    beforeEach(() => {
      matchMediaSpy.mockImplementation((query: string) => {
        if (query === '(pointer: coarse)') {
          return { matches: true };
        }
        return { matches: false };
      });
    });

    it('should return stable function reference', async () => {
      const { result, rerender } = renderHook(() => useHapticFeedback({ pattern: 10 }));

      const firstRef = result.current;

      await act(async () => {
        rerender();
      });

      const secondRef = result.current;

      expect(firstRef).toBe(secondRef);
    });

    it('should maintain stable reference even when pattern changes', async () => {
      const { result, rerender } = renderHook(
        ({ pattern }) => useHapticFeedback({ pattern }),
        { initialProps: { pattern: 10 } }
      );

      const firstRef = result.current;

      await act(async () => {
        rerender({ pattern: 50 });
      });

      const secondRef = result.current;

      // Function reference should be stable (useCallback)
      expect(firstRef).toBe(secondRef);
    });
  });
});
