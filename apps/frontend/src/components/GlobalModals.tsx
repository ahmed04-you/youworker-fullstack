"use client";

import { useState, useEffect } from 'react';
import { CommandPalette } from '@/components/CommandPalette';
import { HelpModal } from '@/components/HelpModal';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

/**
 * GlobalModals component
 * Manages global modals like CommandPalette and HelpModal
 * Handles keyboard shortcuts for opening these modals
 */
export function GlobalModals() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Cmd/Ctrl+K for command palette
  useKeyboardShortcut('k', () => setCommandPaletteOpen(true), { ctrl: true });

  // ? for help modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for '?' key (shift + /)
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // Don't trigger if user is typing in an input/textarea
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        setHelpModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <HelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
    </>
  );
}
