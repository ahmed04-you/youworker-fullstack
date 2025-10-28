/**
 * CommandPalette - Global search and command interface
 */
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Home,
  FileText,
  Clock,
  BarChart3,
  Settings,
  MessageSquare,
  Search,
  Plus,
} from 'lucide-react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useSessionsQuery } from '@/features/chat/api/session-service';
import { useDocuments } from '@/features/documents/api/document-service';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CommandPalette provides quick access to navigation and actions
 * Triggered by Cmd/Ctrl+K
 *
 * @param open - Whether the palette is open
 * @param onOpenChange - Callback to control open state
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <CommandPalette open={open} onOpenChange={setOpen} />
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: sessions } = useSessionsQuery();
  const { data: documentsData } = useDocuments();

  // Filter results based on search
  const filteredSessions = sessions?.filter((s) =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5) || [];

  const filteredDocuments = documentsData?.documents?.filter((d) =>
    d.name?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5) || [];

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-[600px]">
        <Command className="rounded-lg border-0 shadow-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search sessions, documents, or navigate..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Command.Group heading="Navigate">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Home className="h-4 w-4" />
                <span>Chat</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/documents'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" />
                <span>Documents</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/sessions'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Clock className="h-4 w-4" />
                <span>Sessions</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/analytics'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/settings'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Command.Item>
            </Command.Group>

            {/* Recent Sessions */}
            {filteredSessions.length > 0 && (
              <Command.Group heading="Recent Sessions">
                {filteredSessions.map((session) => (
                  <Command.Item
                    key={session.id}
                    onSelect={() => runCommand(() => router.push(`/?session=${session.id}`))}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="flex-1 truncate">
                      {session.title || session.external_id || `Session #${session.id}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Documents */}
            {filteredDocuments.length > 0 && (
              <Command.Group heading="Documents">
                {filteredDocuments.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    onSelect={() => runCommand(() => router.push('/documents'))}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="flex-1 truncate">
                      {doc.name || `Document #${doc.id}`}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                <span>New conversation</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to control command palette from anywhere
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  // Cmd/Ctrl+K to open
  useKeyboardShortcut('k', () => setOpen(true), { ctrl: true });

  return { open, setOpen };
}
