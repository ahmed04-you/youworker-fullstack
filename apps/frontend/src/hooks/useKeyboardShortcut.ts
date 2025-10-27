/**
 * Hook for registering keyboard shortcuts
 */
"use client";

import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Registers a keyboard shortcut
 *
 * @param key - The key to listen for (e.g., 'k', 'Enter', 'Escape')
 * @param callback - Function to call when shortcut is triggered
 * @param options - Modifier keys (ctrl, meta, shift, alt)
 *
 * @example
 * useKeyboardShortcut('k', () => setOpen(true), { ctrl: true });
 * useKeyboardShortcut('/', () => focusInput(), {});
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { ctrl = false, meta = false, shift = false, alt = false } = options;

      // Check if the modifiers match
      const ctrlMatch = ctrl ? e.ctrlKey || e.metaKey : true;
      const metaMatch = meta ? e.metaKey : true;
      const shiftMatch = shift ? e.shiftKey : true;
      const altMatch = alt ? e.altKey : true;

      // Check if key matches and modifiers match
      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        ctrlMatch &&
        metaMatch &&
        shiftMatch &&
        altMatch
      ) {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          // Allow shortcuts with ctrl/meta even in inputs
          if (!ctrl && !meta) {
            return;
          }
        }

        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}

/**
 * Gets a human-readable string for a keyboard shortcut
 * @param key - The key
 * @param options - Modifier options
 * @returns Formatted shortcut string (e.g., "⌘K" or "Ctrl+K")
 */
export function formatShortcut(key: string, options: KeyboardShortcutOptions = {}): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (options.ctrl || options.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (options.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (options.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  parts.push(key.toUpperCase());

  return isMac ? parts.join('') : parts.join('+');
}
