"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseHapticFeedbackOptions {
  pattern?: number | number[];
  enabled?: boolean;
}

/**
 * Provides a safe way to trigger haptic feedback on supported touch devices.
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
