/**
 * Dialog component for renaming sessions
 * Replaces window.prompt() with a proper modal dialog
 */
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SessionSummary } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface RenameSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionSummary | null;
  onRename: (sessionId: number, title: string) => Promise<void>;
}

/**
 * RenameSessionDialog provides a user-friendly interface for renaming sessions
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog state
 * @param session - The session to rename
 * @param onRename - Async callback to handle the rename operation
 *
 * @example
 * <RenameSessionDialog
 *   open={isRenameDialogOpen}
 *   onOpenChange={setIsRenameDialogOpen}
 *   session={selectedSession}
 *   onRename={handleRename}
 * />
 */
export function RenameSessionDialog({
  open,
  onOpenChange,
  session,
  onRename,
}: RenameSessionDialogProps) {
  const [title, setTitle] = useState(session?.title || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !title.trim()) return;

    setIsLoading(true);
    try {
      await onRename(session.id, title.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to rename session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset title when dialog opens/session changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTitle(session?.title || '');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Give this conversation a meaningful name to find it easily later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title..."
              className="mt-2"
              disabled={isLoading}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
