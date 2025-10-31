'use client';

import { forwardRef, useState, useRef, useEffect } from 'react';
import { Plus, Send, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { FileIcon } from '@/components/ui/file-icon';
import type { Attachment } from '@/lib/utils/mock-data';

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onAttach?: () => void;
  attachments?: Attachment[];
  onRemoveAttachment?: (attachmentId: string) => void;
  isGenerating?: boolean;
  isModelLoaded?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  placeholder?: string;
  statusText?: string;
  className?: string;
}

export const TextInputArea = forwardRef<HTMLDivElement, TextInputAreaProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onStop,
      onAttach,
      attachments = [],
      onRemoveAttachment,
      isGenerating = false,
      isModelLoaded = true,
      hasError = false,
      errorMessage,
      placeholder,
      statusText,
      className,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

    // Auto-resize textarea
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (unless Shift+Enter or Ctrl+Shift+Enter for newline)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (value.trim() && !isGenerating && isModelLoaded) {
          onSubmit();
        }
      }

      // Allow Shift+Enter or Ctrl+Shift+Enter for newline
      if (e.key === 'Enter' && (e.shiftKey || (e.ctrlKey && e.shiftKey))) {
        // Let the default behavior happen (insert newline)
        return;
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    };

    const handleSendClick = () => {
      if (value.trim() && !isGenerating && isModelLoaded) {
        onSubmit();
      }
    };

    const handleStopClick = () => {
      if (isGenerating && onStop) {
        onStop();
      }
    };

    const getPlaceholder = () => {
      if (placeholder) return placeholder;
      if (!isModelLoaded) return 'Load a model to continue...';
      return 'Send a message...';
    };

    const canSubmit = value.trim() && !isGenerating && isModelLoaded;

    return (
      <div
        ref={ref}
        className={cn(
          // Size and position
          'w-[calc(100%-60px)] min-h-[60px] max-h-[240px]',
          'mx-[30px] my-[30px]',
          'sticky bottom-0',

          // Background and border
          'bg-[var(--bg-control)]',
          hasError
            ? 'border-2 border-[var(--error-color)]'
            : 'border border-[var(--border-control)]',
          'rounded-[var(--radius-standard)]', // 10px

          // Responsive
          'md:w-[calc(100%-60px)] md:mx-[30px]',
          'max-md:w-[calc(100%-30px)] max-md:mx-[15px]',

          className
        )}
      >
        {/* Grid Container */}
        <div
          className={cn(
            'grid gap-[10px] p-[10px]',
            attachments.length > 0
              ? 'grid-rows-[auto_auto] grid-cols-[auto_1fr_auto]'
              : 'grid-rows-[auto] grid-cols-[auto_1fr_auto]'
          )}
        >
          {/* Row 1: Attachments (spans all columns) */}
          {attachments.length > 0 && (
            <div className="col-span-3 flex flex-wrap gap-[10px]">
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => onRemoveAttachment?.(attachment.id)}
                />
              ))}
            </div>
          )}

          {/* Row 2, Col 0: Plus Button */}
          <button
            onClick={onAttach}
            disabled={!isModelLoaded || isGenerating}
            className={cn(
              'w-[40px] h-[40px]',
              'self-end mb-[15px]',
              'flex items-center justify-center',
              'bg-transparent border-none',
              'rounded-[var(--radius-small)]', // 5px
              'cursor-pointer',
              'text-[var(--text-muted)]',
              'transition-all duration-[var(--duration-standard)]',
              'hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            aria-label="Attach file"
          >
            <Plus className="w-[24px] h-[24px]" />
          </button>

          {/* Row 2, Col 1: Text Input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            disabled={!isModelLoaded}
            placeholder={getPlaceholder()}
            className={cn(
              // Size
              'w-full min-h-[40px] max-h-[200px]',
              'px-[10px] py-[10px]',

              // Resize and scroll
              'resize-none overflow-y-auto',

              // Background and border
              'bg-transparent border-none',
              'rounded-[var(--radius-small)]',

              // Typography
              'font-[family-name:var(--font-primary)] text-[length:var(--font-larger)]', // 14pt / ~18.7px
              'text-[var(--text-color)]',

              // Placeholder
              'placeholder:text-[var(--text-muted)]',

              // Focus
              'focus:outline-none',

              // Disabled
              'disabled:opacity-50 disabled:cursor-not-allowed',

              // Scrollbar
              'scrollbar-thin scrollbar-thumb-[var(--border-control)] scrollbar-track-transparent'
            )}
            aria-label="Message input"
          />

          {/* Row 2, Col 2: Send/Stop Button */}
          {isGenerating ? (
            <button
              onClick={handleStopClick}
              className={cn(
                'w-[40px] h-[40px]',
                'self-end mb-[15px]',
                'flex items-center justify-center',
                'bg-[var(--bg-control)]',
                'border border-[var(--border-control)]',
                'rounded-full',
                'cursor-pointer',
                'text-[var(--error-color)]',
                'transition-all duration-[var(--duration-standard)]',
                'hover:border-[var(--error-color)] hover:bg-[var(--bg-sources)]'
              )}
              aria-label="Stop generating"
            >
              <Square className="w-[16px] h-[16px] fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSendClick}
              disabled={!canSubmit}
              className={cn(
                'w-[40px] h-[40px]',
                'self-end mb-[15px]',
                'flex items-center justify-center',
                'border-none rounded-full',
                'cursor-pointer',
                'text-[var(--text-opposite)]',
                'transition-all duration-[var(--duration-standard)]',
                canSubmit
                  ? 'bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)]'
                  : 'bg-[var(--bg-lighter-button)] opacity-50 cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <Send className="w-[20px] h-[20px]" />
            </button>
          )}
        </div>

        {/* Error Message */}
        {hasError && errorMessage && (
          <div
            className={cn(
              'px-[10px] pb-[10px]',
              'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]',
              'text-[var(--error-color)]'
            )}
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {/* Status Bar */}
        {statusText && (
          <div
            className={cn(
              'absolute -bottom-[25px] right-0',
              'flex gap-[10px]',
              'px-[5px] py-[5px]',
              'font-[family-name:var(--font-primary)] text-[length:var(--font-smaller)]', // 9pt / ~12px
              'font-bold',
              'text-[var(--text-muted)]'
            )}
          >
            {statusText}
          </div>
        )}

        {/* Context Menu */}
        {showContextMenu && (
          <ContextMenu
            x={contextMenuPosition.x}
            y={contextMenuPosition.y}
            onClose={() => setShowContextMenu(false)}
            textareaRef={textareaRef}
          />
        )}
      </div>
    );
  }
);

TextInputArea.displayName = 'TextInputArea';

/* ============================================================================
   Sub-Components
   ============================================================================ */

interface AttachmentCardProps {
  attachment: Attachment;
  onRemove?: () => void;
}

const AttachmentCard = ({ attachment, onRemove }: AttachmentCardProps) => {
  return (
    <div
      className={cn(
        'w-[350px] h-[50px]',
        'grid grid-cols-[40px_265px_auto] items-center gap-[5px]',
        'px-[10px] py-[5px]',
        'bg-[var(--bg-attachment)] border border-[var(--border-control)]',
        'rounded-[var(--radius-standard)]'
      )}
    >
      <FileIcon fileName={attachment.filename} size={40} className="w-[40px] h-[40px]" />

      <span
        className={cn(
          'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]',
          'text-[var(--text-color)]',
          'overflow-hidden text-ellipsis whitespace-nowrap'
        )}
        title={attachment.filename}
      >
        {attachment.filename}
      </span>

      {onRemove && (
        <button
          onClick={onRemove}
          className={cn(
            'w-[24px] h-[24px]',
            'flex items-center justify-center',
            'bg-transparent rounded-full',
            'text-[var(--text-muted)]',
            'transition-all duration-[var(--duration-standard)]',
            'hover:bg-[var(--bg-sources-hover)] hover:text-[var(--error-color)]'
          )}
          aria-label={`Remove ${attachment.filename}`}
        >
          <X className="w-[16px] h-[16px]" />
        </button>
      )}
    </div>
  );
};

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ContextMenu = ({ x, y, onClose, textareaRef }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCut = () => {
    document.execCommand('cut');
    onClose();
  };

  const handleCopy = () => {
    document.execCommand('copy');
    onClose();
  };

  const handlePaste = () => {
    document.execCommand('paste');
    onClose();
  };

  const handleSelectAll = () => {
    textareaRef.current?.select();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[1000]',
        'min-w-[120px]',
        'bg-[var(--context-menu-bg)]',
        'border border-[var(--context-menu-frame)]',
        'rounded-[var(--radius-small)]',
        'py-[5px]',
        'shadow-lg'
      )}
      style={{ left: x, top: y }}
      role="menu"
    >
      <ContextMenuItem label="Cut" onClick={handleCut} />
      <ContextMenuItem label="Copy" onClick={handleCopy} />
      <ContextMenuItem label="Paste" onClick={handlePaste} />
      <div className="h-[1px] bg-[var(--border-divider)] my-[5px]" />
      <ContextMenuItem label="Select All" onClick={handleSelectAll} />
    </div>
  );
};

interface ContextMenuItemProps {
  label: string;
  onClick: () => void;
}

const ContextMenuItem = ({ label, onClick }: ContextMenuItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-[15px] py-[8px]',
        'text-left',
        'bg-transparent border-none',
        'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]',
        'text-[var(--text-color)]',
        'cursor-pointer',
        'transition-colors duration-[var(--duration-quick)]',
        'hover:bg-[var(--context-menu-highlight)]'
      )}
      role="menuitem"
    >
      {label}
    </button>
  );
};
