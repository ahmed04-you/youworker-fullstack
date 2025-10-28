/**
 * Hook for registering keyboard shortcuts
 */
"use client";

import { useEffect, useRef } from 'react';
import { parseKeyboardEvent } from '@/lib/shortcuts';

interface KeyboardShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
  ignoreInputs?: boolean;
}

/**
 * Registers a keyboard shortcut
 *
 * @param key - The key to listen for (e.g., 'k', 'Enter', 'Escape')
 * @param callback - Function to call when shortcut is triggered
 * @param options - Modifier keys (ctrl, meta, shift, alt) and behavior options
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
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const {
      ctrl = false,
      meta = false,
      shift = false,
      alt = false,
      enabled = true,
      preventDefault = true,
      ignoreInputs = true,
    } = options;

    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
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
        if (ignoreInputs) {
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
        }

        if (preventDefault) {
          e.preventDefault();
        }
        callbackRef.current();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, options]);
}

/**
 * Hook for handling multiple keyboard shortcuts at once
 * Uses the shortcuts.ts format (e.g., "cmd+k", "esc", "cmd+shift+v")
 *
 * @param shortcuts - Record of shortcut keys mapped to their handlers
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   'cmd+k': () => setCommandPaletteOpen(true),
 *   'cmd+n': () => createNewSession(),
 *   'esc': () => closeModal(),
 * });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, (event: KeyboardEvent) => void>,
  options: Omit<KeyboardShortcutOptions, 'ctrl' | 'meta' | 'shift' | 'alt'> = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    ignoreInputs = true,
  } = options;

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (ignoreInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isEditable = target.isContentEditable;

        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          isEditable
        ) {
          const eventKey = parseKeyboardEvent(event);
          const handler = shortcutsRef.current[eventKey];

          if (handler && (eventKey === 'esc' || eventKey.includes('cmd'))) {
            if (preventDefault) {
              event.preventDefault();
            }
            handler(event);
          }
          return;
        }
      }

      const eventKey = parseKeyboardEvent(event);
      const handler = shortcutsRef.current[eventKey];

      if (handler) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, preventDefault, ignoreInputs]);
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
