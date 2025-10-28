"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseHapticFeedbackOptions {
  pattern?: number | number[];
  enabled?: boolean;
}

/**
 * Hook for triggering haptic/vibration feedback on supported touch devices.
 * Automatically checks for browser support, touch device, and user preferences (prefers-reduced-motion).
 *
 * @param options - Configuration options
 * @param options.pattern - Vibration pattern in milliseconds (single number or array) (default: 10)
 * @param options.enabled - Whether haptic feedback is enabled (default: true)
 *
 * @returns Function to trigger haptic feedback with optional custom pattern.
 *          Returns false if not supported or failed, true if successful.
 *
 * @example
 * ```tsx
 * const triggerHaptic = useHapticFeedback({ pattern: 50 });
 *
 * const handleButtonClick = () => {
 *   triggerHaptic(); // Uses default pattern
 *   // or
 *   triggerHaptic([10, 50, 10]); // Uses custom pattern
 * };
 * ```
 */
export function useHapticFeedback(options: UseHapticFeedbackOptions = {}) {
  const { pattern = 10, enabled = true } = options;
  const isSupportedRef = useRef(false);
  const patternRef = useRef<number | number[]>(pattern);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    if (!enabled) {
      isSupportedRef.current = false;
      return;
    }

    if (typeof navigator === "undefined" || typeof window === "undefined") {
      isSupportedRef.current = false;
      return;
    }

    const hasVibrate = typeof navigator.vibrate === "function";
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;

    isSupportedRef.current = hasVibrate && isCoarsePointer && !prefersReducedMotion;
  }, [enabled]);

  return useCallback((customPattern?: number | number[]) => {
    if (!isSupportedRef.current) {
      return false;
    }

    const patternToUse = customPattern ?? patternRef.current;

    try {
      return navigator.vibrate(patternToUse);
    } catch {
      return false;
    }
  }, []);
}
