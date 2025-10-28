export interface Shortcut {
  key: string;
  action: string;
  description: string;
  category: 'navigation' | 'editing' | 'chat' | 'documents' | 'general';
  handler?: () => void;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

/**
 * Default keyboard shortcuts for the application
 * These shortcuts work across different operating systems with automatic key detection
 */
export const SHORTCUTS: Record<string, Shortcut> = {
  // Navigation shortcuts
  'cmd+n': {
    key: 'cmd+n',
    action: 'New Session',
    description: 'Start a new chat session',
    category: 'navigation',
  },
  'cmd+k': {
    key: 'cmd+k',
    action: 'Command Palette',
    description: 'Open command palette for quick actions',
    category: 'navigation',
  },
  'cmd+b': {
    key: 'cmd+b',
    action: 'Toggle Sidebar',
    description: 'Show or hide the navigation sidebar',
    category: 'navigation',
  },
  'cmd+,': {
    key: 'cmd+,',
    action: 'Settings',
    description: 'Open settings page',
    category: 'navigation',
  },

  // Chat shortcuts
  'cmd+enter': {
    key: 'cmd+enter',
    action: 'Send Message',
    description: 'Send the current message',
    category: 'chat',
  },
  'cmd+shift+v': {
    key: 'cmd+shift+v',
    action: 'Voice Input',
    description: 'Start voice recording for input',
    category: 'chat',
  },
  'esc': {
    key: 'esc',
    action: 'Stop',
    description: 'Stop current streaming response or close modal',
    category: 'chat',
  },
  'cmd+shift+c': {
    key: 'cmd+shift+c',
    action: 'Copy Last Response',
    description: 'Copy the last assistant response to clipboard',
    category: 'chat',
  },

  // Document shortcuts
  'cmd+u': {
    key: 'cmd+u',
    action: 'Upload Document',
    description: 'Open document upload dialog',
    category: 'documents',
  },
  'cmd+d': {
    key: 'cmd+d',
    action: 'View Documents',
    description: 'Navigate to documents page',
    category: 'documents',
  },

  // Editing shortcuts
  'cmd+z': {
    key: 'cmd+z',
    action: 'Undo',
    description: 'Undo last action',
    category: 'editing',
  },
  'cmd+shift+z': {
    key: 'cmd+shift+z',
    action: 'Redo',
    description: 'Redo last undone action',
    category: 'editing',
  },

  // General shortcuts
  '?': {
    key: '?',
    action: 'Help',
    description: 'Show keyboard shortcuts help',
    category: 'general',
  },
  'cmd+/': {
    key: 'cmd+/',
    action: 'Toggle Theme',
    description: 'Switch between light and dark theme',
    category: 'general',
  },
};

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(): ShortcutCategory[] {
  const categories = new Map<string, Shortcut[]>();

  Object.values(SHORTCUTS).forEach((shortcut) => {
    const existing = categories.get(shortcut.category) || [];
    categories.set(shortcut.category, [...existing, shortcut]);
  });

  const categoryNames: Record<string, string> = {
    navigation: 'Navigation',
    chat: 'Chat',
    documents: 'Documents',
    editing: 'Editing',
    general: 'General',
  };

  return Array.from(categories.entries()).map(([category, shortcuts]) => ({
    name: categoryNames[category] || category,
    shortcuts,
  }));
}

/**
 * Detect the user's operating system for displaying the correct modifier key
 */
export function getModifierKey(): 'Cmd' | 'Ctrl' {
  if (typeof window === 'undefined') return 'Cmd';

  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'Cmd';
  }

  return 'Ctrl';
}

/**
 * Format a shortcut key for display based on the user's OS
 * Converts 'cmd' to 'Cmd' on Mac or 'Ctrl' on Windows/Linux
 */
export function formatShortcutKey(key: string): string {
  const modifierKey = getModifierKey();
  return key.replace(/cmd/gi, modifierKey);
}

/**
 * Parse a keyboard event to a shortcut string
 * Example: Cmd+N, Ctrl+Shift+V, etc.
 */
export function parseKeyboardEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.metaKey || event.ctrlKey) {
    parts.push('cmd');
  }
  if (event.shiftKey) {
    parts.push('shift');
  }
  if (event.altKey) {
    parts.push('alt');
  }

  const key = event.key.toLowerCase();
  if (key !== 'meta' && key !== 'control' && key !== 'shift' && key !== 'alt') {
    parts.push(key === ' ' ? 'space' : key);
  }

  return parts.join('+');
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcutKey: string): boolean {
  const eventKey = parseKeyboardEvent(event);
  return eventKey === shortcutKey.toLowerCase();
}
