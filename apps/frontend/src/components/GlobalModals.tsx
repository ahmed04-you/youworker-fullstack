"use client";

import { useState } from 'react';
import { CommandPalette } from '@/components/CommandPalette';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

/**
 * GlobalModals component
 * Manages global modals like CommandPalette
 * Handles keyboard shortcuts for opening these modals
 */
export function GlobalModals() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Cmd/Ctrl+K for command palette
  useKeyboardShortcut('k', () => setCommandPaletteOpen(true), { ctrl: true });

  return (
    <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
  );
}
