"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Keyboard } from 'lucide-react';
import { formatShortcutKey } from '@/lib/shortcuts';

interface ShortcutHint {
  key: string;
  action: string;
}

const commonShortcuts: ShortcutHint[] = [
  { key: 'cmd+k', action: 'Command Palette' },
  { key: 'cmd+n', action: 'New Session' },
  { key: '?', action: 'Help' },
  { key: 'esc', action: 'Close/Stop' },
];

/**
 * Floating keyboard shortcuts hint component
 * Shows a dismissible hint about common keyboard shortcuts
 */
export function KeyboardShortcutsHint() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the hint
    const dismissed = localStorage.getItem('shortcuts-hint-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Show hint after a delay (let the app load first)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('shortcuts-hint-dismissed', 'true');
  };

  const handleDismissTemporarily = () => {
    setIsVisible(false);
  };

  if (!isVisible || isDismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 p-4 shadow-lg max-w-sm animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Keyboard className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Keyboard Shortcuts</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismissTemporarily}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Boost your productivity with these shortcuts:
          </p>
          <div className="space-y-1.5">
            {commonShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono min-w-[60px] text-center">
                  {formatShortcutKey(shortcut.key)}
                </kbd>
                <span className="text-muted-foreground">{shortcut.action}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                handleDismissTemporarily();
                // Open help modal (this would be better connected to actual help modal)
                window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
              }}
            >
              View All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={handleDismiss}
            >
              Don't show again
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
