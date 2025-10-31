'use client';

import { forwardRef, useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Edit2, RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { FileIcon } from '@/components/ui/file-icon';
import { SuggestedFollowUp } from './suggested-follow-up';
import type { Message, Attachment, Source } from '@/lib/utils/mock-data';

interface ChatItemViewProps {
  message: Message;
  isFirst?: boolean;
  isGenerating?: boolean;
  onCopy?: () => void;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

export const ChatItemView = forwardRef<HTMLDivElement, ChatItemViewProps>(
  (
    {
      message,
      isFirst = false,
      isGenerating = false,
      onCopy,
      onThumbsUp,
      onThumbsDown,
      onEdit,
      onRegenerate,
      onRemoveAttachment,
      onSuggestionClick,
      className,
    },
    ref
  ) => {
    const isUser = message.role === 'user';
    const [thumbsUpActive, setThumbsUpActive] = useState(false);
    const [thumbsDownActive, setThumbsDownActive] = useState(false);

    const handleThumbsUp = () => {
      setThumbsUpActive(!thumbsUpActive);
      setThumbsDownActive(false);
      onThumbsUp?.();
    };

    const handleThumbsDown = () => {
      setThumbsDownActive(!thumbsDownActive);
      setThumbsUpActive(false);
      onThumbsDown?.();
    };

    return (
      <div
        ref={ref}
        className={cn('flex gap-[10px] w-full', className)}
        role="article"
        aria-label={`${isUser ? 'Your' : 'AI'} message`}
      >
        {/* Avatar */}
        <Avatar role={message.role} isGenerating={isGenerating} isFirst={isFirst} />

        {/* Message Content Container */}
        <div className="flex-1 flex flex-col">
          {/* Header Row */}
          <MessageHeader
            role={message.role}
            modelName={message.modelName}
            status={message.status}
          />

          {/* Message Content */}
          <MessageContent content={message.content} />

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentsSection
              attachments={message.attachments}
              onRemove={onRemoveAttachment}
            />
          )}

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <SourcesSection sources={message.sources} />
          )}

          {/* Action Buttons (for AI messages) */}
          {!isUser && (
            <ActionButtons
              onCopy={onCopy}
              onThumbsUp={handleThumbsUp}
              onThumbsDown={handleThumbsDown}
              onRegenerate={onRegenerate}
              thumbsUpActive={thumbsUpActive}
              thumbsDownActive={thumbsDownActive}
            />
          )}

          {/* Action Buttons (for user messages) */}
          {isUser && (
            <UserActionButtons onCopy={onCopy} onEdit={onEdit} />
          )}

          {/* Suggested Follow-ups (for AI messages) */}
          {!isUser && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
            <SuggestedFollowUp
              suggestions={message.suggestedFollowUps}
              onSuggestionClick={onSuggestionClick}
            />
          )}
        </div>
      </div>
    );
  }
);

ChatItemView.displayName = 'ChatItemView';

/* ============================================================================
   Sub-Components
   ============================================================================ */

interface AvatarProps {
  role: 'user' | 'assistant';
  isGenerating: boolean;
  isFirst: boolean;
}

const Avatar = ({ role, isGenerating, isFirst }: AvatarProps) => {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        // Size
        'w-[32px] h-[32px] min-w-[32px]',

        // Shape
        'rounded-full',

        // Background
        'bg-[var(--bg-lighter-button)]',

        // Flex
        'flex items-center justify-center',

        // Margin (0 for first message, 25px for others)
        isFirst ? 'mt-0' : 'mt-[25px]',

        // Animation (rotate when generating for AI)
        isGenerating && !isUser && 'animate-rotate'
      )}
      aria-label={isUser ? 'Your avatar' : 'AI avatar'}
    >
      {/* Icon - using initials for now, replace with actual icons */}
      <span
        className={cn(
          'text-[var(--text-conversation-header)] font-bold text-[14px]'
        )}
      >
        {isUser ? 'Y' : 'AI'}
      </span>
    </div>
  );
};

interface MessageHeaderProps {
  role: 'user' | 'assistant';
  modelName?: string;
  status?: string;
}

const MessageHeader = ({ role, modelName, status }: MessageHeaderProps) => {
  const isUser = role === 'user';
  const displayName = isUser ? 'You' : 'YouWorker';

  return (
    <div
      className={cn(
        'flex items-center gap-[10px]',
        'h-[38px]',
        'ml-0' // No margin since it's inside flex container with gap
      )}
    >
      {/* Name */}
      <span
        className={cn(
          'font-[family-name:var(--font-primary)] text-[length:var(--font-larger)]', // 14pt / ~18.7px
          'font-bold',
          'text-[var(--text-conversation-header)]'
        )}
      >
        {displayName}
      </span>

      {/* Model Name (for AI) */}
      {!isUser && modelName && (
        <span
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-larger)]',
            'font-normal',
            'text-[var(--text-muted)]',
            'ml-[5px]'
          )}
        >
          {modelName}
        </span>
      )}

      {/* Status (for AI when generating) */}
      {status && (
        <span
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]', // 11pt / ~14.7px
            'text-[var(--text-muted)]',
            'ml-auto'
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
};

interface MessageContentProps {
  content: string;
}

const MessageContent = ({ content }: MessageContentProps) => {
  return (
    <div
      className={cn(
        'ml-0 mt-[10px]',
        'w-full',
        'font-[family-name:var(--font-primary)] text-[length:var(--font-large)]', // 12pt / ~16px
        'text-[var(--text-color)]',
        'leading-[1.5]',
        'whitespace-pre-wrap break-words'
      )}
    >
      {content}
    </div>
  );
};

interface AttachmentsSectionProps {
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => void;
}

const AttachmentsSection = ({ attachments, onRemove }: AttachmentsSectionProps) => {
  return (
    <div
      className={cn('flex flex-col gap-[10px] mt-[10px] ml-0')}
      role="list"
      aria-label="Message attachments"
    >
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove?.(attachment.id)}
        />
      ))}
    </div>
  );
};

interface AttachmentCardProps {
  attachment: Attachment;
  onRemove?: () => void;
}

const AttachmentCard = ({ attachment, onRemove }: AttachmentCardProps) => {
  return (
    <div
      className={cn(
        // Size
        'w-[350px] h-[50px]',

        // Layout
        'grid grid-cols-[40px_265px_auto] items-center gap-[5px]',
        'px-[10px] py-[5px]',

        // Background and border
        'bg-[var(--bg-attachment)] border border-[var(--border-control)]',
        'rounded-[var(--radius-standard)]' // 10px
      )}
      role="listitem"
    >
      {/* File Icon */}
      <FileIcon fileName={attachment.filename} size={40} className="w-[40px] h-[40px]" />

      {/* Filename */}
      <span
        className={cn(
          'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]', // 11pt / ~14.7px
          'text-[var(--text-color)]',
          'overflow-hidden text-ellipsis whitespace-nowrap'
        )}
        title={attachment.filename}
      >
        {attachment.filename}
      </span>

      {/* Remove Button */}
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

interface SourcesSectionProps {
  sources: Source[];
}

const SourcesSection = ({ sources }: SourcesSectionProps) => {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  };

  return (
    <div
      className={cn('flex flex-wrap gap-[10px] mt-[10px] ml-0')}
      role="list"
      aria-label="Message sources"
    >
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          isExpanded={expandedSources.has(source.id)}
          onToggle={() => toggleSource(source.id)}
        />
      ))}
    </div>
  );
};

interface SourceCardProps {
  source: Source;
  isExpanded: boolean;
  onToggle: () => void;
}

const SourceCard = ({ source, isExpanded, onToggle }: SourceCardProps) => {
  return (
    <button
      onClick={onToggle}
      className={cn(
        // Size
        'w-[200px]',
        isExpanded ? 'h-auto' : 'h-[75px]',

        // Layout
        'p-[10px]',
        'flex flex-col items-start',

        // Background and border
        'bg-[var(--bg-sources)]',
        'rounded-[var(--radius-standard)]', // 10px

        // Cursor
        'cursor-pointer',

        // Transitions
        'transition-all duration-[var(--duration-medium)]', // 300ms

        // Hover
        'hover:bg-[var(--bg-sources-hover)]'
      )}
      role="listitem"
      aria-expanded={isExpanded}
    >
      {/* Title */}
      <div className="flex items-center justify-between w-full mb-[5px]">
        <span
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]', // 11pt / ~14.7px
            'font-bold',
            'text-[var(--text-color)]',
            'text-left overflow-hidden text-ellipsis',
            !isExpanded && 'whitespace-nowrap'
          )}
        >
          {source.title}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-[16px] h-[16px] text-[var(--text-muted)] ml-[5px] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-[16px] h-[16px] text-[var(--text-muted)] ml-[5px] flex-shrink-0" />
        )}
      </div>

      {/* Excerpt */}
      <p
        className={cn(
          'font-[family-name:var(--font-primary)] text-[length:var(--font-small)]', // 10pt / ~13.3px
          'text-[var(--text-muted)]',
          'leading-[1.4]',
          'text-left',
          !isExpanded && 'line-clamp-2'
        )}
      >
        {source.excerpt}
      </p>

      {/* Additional info when expanded */}
      {isExpanded && source.file && (
        <span
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-smallest)]', // 8pt / ~10.7px
            'text-[var(--text-muted)]',
            'mt-[5px]',
            'italic'
          )}
        >
          {source.file}
        </span>
      )}
    </button>
  );
};

interface ActionButtonsProps {
  onCopy?: () => void;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  onRegenerate?: () => void;
  thumbsUpActive: boolean;
  thumbsDownActive: boolean;
}

const ActionButtons = ({
  onCopy,
  onThumbsUp,
  onThumbsDown,
  onRegenerate,
  thumbsUpActive,
  thumbsDownActive,
}: ActionButtonsProps) => {
  return (
    <div
      className={cn('flex gap-[15px] mt-[15px] ml-0 items-center')}
      role="toolbar"
      aria-label="Message actions"
    >
      {/* Copy Button */}
      <button
        onClick={onCopy}
        className={cn(
          'bg-transparent border-none',
          'px-[10px] py-[5px]',
          'rounded-[var(--radius-small)]', // 5px
          'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]', // 11pt / ~14.7px
          'text-[var(--text-muted)]',
          'cursor-pointer',
          'transition-all duration-[var(--duration-quick)]', // 30ms
          'hover:opacity-100 hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]'
        )}
        aria-label="Copy message"
      >
        Copy
      </button>

      {/* Thumbs Up */}
      <button
        onClick={onThumbsUp}
        className={cn(
          'w-[24px] h-[24px]',
          'bg-transparent border-none',
          'cursor-pointer',
          'transition-all duration-[var(--duration-standard)]',
          thumbsUpActive
            ? 'opacity-100 grayscale-0'
            : 'opacity-20 grayscale hover:opacity-60'
        )}
        aria-label="Thumbs up"
        aria-pressed={thumbsUpActive}
      >
        <ThumbsUp className={cn('w-full h-full', thumbsUpActive && 'text-green-600')} />
      </button>

      {/* Thumbs Down */}
      <button
        onClick={onThumbsDown}
        className={cn(
          'w-[24px] h-[24px]',
          'bg-transparent border-none',
          'cursor-pointer',
          'transition-all duration-[var(--duration-standard)]',
          thumbsDownActive
            ? 'opacity-100 grayscale-0'
            : 'opacity-20 grayscale hover:opacity-60'
        )}
        aria-label="Thumbs down"
        aria-pressed={thumbsDownActive}
      >
        <ThumbsDown className={cn('w-full h-full', thumbsDownActive && 'text-red-600')} />
      </button>

      {/* Regenerate Button */}
      <button
        onClick={onRegenerate}
        className={cn(
          'w-[24px] h-[24px]',
          'flex items-center justify-center',
          'bg-transparent',
          'rounded-[var(--radius-small)]',
          'p-[5px]',
          'cursor-pointer',
          'text-[var(--text-muted)]',
          'transition-all duration-[var(--duration-standard)]',
          'hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]'
        )}
        aria-label="Regenerate response"
      >
        <RotateCcw className="w-full h-full" />
      </button>
    </div>
  );
};

interface UserActionButtonsProps {
  onCopy?: () => void;
  onEdit?: () => void;
}

const UserActionButtons = ({ onCopy, onEdit }: UserActionButtonsProps) => {
  return (
    <div
      className={cn('flex gap-[15px] mt-[15px] ml-0 items-center')}
      role="toolbar"
      aria-label="Message actions"
    >
      {/* Copy Button */}
      <button
        onClick={onCopy}
        className={cn(
          'bg-transparent border-none',
          'px-[10px] py-[5px]',
          'rounded-[var(--radius-small)]',
          'font-[family-name:var(--font-primary)] text-[length:var(--font-medium)]',
          'text-[var(--text-muted)]',
          'cursor-pointer',
          'transition-all duration-[var(--duration-quick)]',
          'hover:opacity-100 hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]'
        )}
        aria-label="Copy message"
      >
        Copy
      </button>

      {/* Edit Button */}
      <button
        onClick={onEdit}
        className={cn(
          'w-[24px] h-[24px]',
          'flex items-center justify-center',
          'bg-transparent',
          'rounded-[var(--radius-small)]',
          'p-[5px]',
          'cursor-pointer',
          'text-[var(--text-muted)]',
          'transition-all duration-[var(--duration-standard)]',
          'hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]'
        )}
        aria-label="Edit message"
      >
        <Edit2 className="w-full h-full" />
      </button>
    </div>
  );
};
