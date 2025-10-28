import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, Mail, ExternalLink } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import { getShortcutsByCategory, formatShortcutKey } from '@/lib/shortcuts';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { settings } = useSettings();

  const faqItems = [
    {
      question: 'How do I start a new chat session?',
      answer: 'Press Cmd+N or click the + button in the sidebar to start a new conversation.',
    },
    {
      question: 'How do I use voice input?',
      answer: 'Click the microphone icon in the chat composer or press Cmd+Shift+V to start voice recording.',
    },
    {
      question: 'What are AI tools?',
      answer: 'AI tools are specialized functions like web search, calculations, and unit conversions available through the tools button in the chat.',
    },
    {
      question: 'How do I upload documents?',
      answer: 'Go to the Documents page or use the upload button in the sidebar to add files for the AI to reference.',
    },
    {
      question: 'How do I view analytics?',
      answer: 'Navigate to the Analytics page to see token usage, tool performance, and ingestion statistics.',
    },
    {
      question: 'What are keyboard shortcuts?',
      answer: 'Press ? to open this help modal. Common shortcuts: Cmd+Enter to send, Esc to stop, Cmd+K for command palette.',
    },
    {
      question: 'How do I change the theme?',
      answer: 'Go to Settings > Theme to switch between light, dark, or system theme.',
    },
    {
      question: 'How do I manage my API key?',
      answer: 'In Settings > API Configuration, you can add, update, or remove your API key.',
    },
  ];

  const filteredFAQ = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get all shortcuts from shortcuts.ts and filter them
  const shortcutCategories = getShortcutsByCategory();
  const allShortcuts = shortcutCategories.flatMap(cat =>
    cat.shortcuts.map(s => ({
      key: formatShortcutKey(s.key),
      action: s.action,
      description: s.description,
    }))
  );

  const filteredShortcuts = allShortcuts.filter(shortcut =>
    shortcut.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shortcut.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
          <span className="sr-only">Open Help</span>
          ?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Help & FAQ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search help articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FAQ Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
              <div className="space-y-3">
                {filteredFAQ.map((item, index) => (
                  <div key={index} className="space-y-1 border-b border-border/50 pb-3 last:border-b-0">
                    <h4 className="font-medium text-sm">{item.question}</h4>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
                {filteredFAQ.length === 0 && (
                  <p className="text-muted-foreground">No results found. Try a different search term.</p>
                )}
              </div>
            </div>

            {/* Shortcuts Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex flex-col gap-1 py-2 border-b border-border/50 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono whitespace-nowrap">
                        {shortcut.key}
                      </kbd>
                      <span className="text-sm font-medium">{shortcut.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">{shortcut.description}</p>
                  </div>
                ))}
                {filteredShortcuts.length === 0 && (
                  <p className="text-muted-foreground">No shortcuts match your search.</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Custom shortcuts can be configured in Settings</p>
              </div>
            </div>
          </div>

          {/* Contact Support Section */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-sm">Need More Help?</h3>
                <p className="text-sm text-muted-foreground">
                  Can't find what you're looking for? Contact our support team or visit our documentation.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="mailto:support@youworker.ai">
                      <Mail className="mr-2 h-3 w-3" />
                      Contact Support
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/docs" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View Docs
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}