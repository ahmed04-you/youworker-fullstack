'use client';

import { forwardRef, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { ChatItemView } from './chat-item-view';
import { TextInputArea } from './text-input-area';
import { ConversationTray } from './conversation-tray';
import { useChatStore } from '@/lib/stores/chat-store';
import type { Message } from '@/lib/utils/mock-data';

interface ChatViewProps {
  messages?: Message[];
  onSendMessage?: (content: string) => void;
  onStopGenerating?: () => void;
  onResetConversation?: () => void;
  onCopyConversation?: () => void;
  isGenerating?: boolean;
  isModelLoaded?: boolean;
  className?: string;
}

export const ChatView = forwardRef<HTMLDivElement, ChatViewProps>(
  (
    {
      messages: propMessages,
      onSendMessage,
      onStopGenerating,
      onResetConversation,
      onCopyConversation,
      isGenerating = false,
      isModelLoaded = true,
      className,
    },
    ref
  ) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showTray, setShowTray] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Use store if messages not provided via props
    const storeMessages = useChatStore((state) => state.messages);
    const messages = propMessages || storeMessages;

    const hasMessages = messages && messages.length > 0;

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, [messages]);

    const handleSubmit = () => {
      if (inputValue.trim() && onSendMessage) {
        onSendMessage(inputValue);
        setInputValue('');
      }
    };

    const handleCopyMessage = (message: Message) => {
      navigator.clipboard.writeText(message.content);
      // TODO: Show toast notification
    };

    const handleCopyConversation = () => {
      const conversationText = messages
        .map((msg) => `${msg.role === 'user' ? 'You' : 'YouWorker'}: ${msg.content}`)
        .join('\n\n');
      navigator.clipboard.writeText(conversationText);
      onCopyConversation?.();
      // TODO: Show toast notification
    };

    return (
      <div
        ref={ref}
        className={cn('flex flex-col flex-1 w-full h-full relative', className)}
      >
        {/* Conversation Area */}
        <div
          ref={scrollContainerRef}
          className={cn(
            // Size
            'flex-1 w-full',
            'max-w-[1280px] mx-auto',
            'px-[50px] py-[20px]',

            // Scroll
            'overflow-y-auto overflow-x-hidden',

            // Background
            'bg-[var(--bg-conversation)]',

            // Hide scrollbar
            'scrollbar-none',
            '[&::-webkit-scrollbar]:hidden',
            '[-ms-overflow-style:none]',
            '[scrollbar-width:none]'
          )}
          onMouseEnter={() => setShowTray(true)}
          onMouseLeave={() => setShowTray(false)}
        >
          {/* Empty State */}
          {!hasMessages && <EmptyState isModelLoaded={isModelLoaded} />}

          {/* Messages List */}
          {hasMessages && (
            <div className="flex flex-col gap-[10px] w-full">
              {messages.map((message, index) => (
                <ChatItemView
                  key={message.id}
                  message={message}
                  isFirst={index === 0}
                  isGenerating={isGenerating && index === messages.length - 1}
                  onCopy={() => handleCopyMessage(message)}
                  onSuggestionClick={(suggestion) => {
                    setInputValue(suggestion);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Conversation Tray (floating controls) */}
        <div
          className="relative"
          onMouseEnter={() => setShowTray(true)}
          onMouseLeave={() => setShowTray(false)}
        >
          <ConversationTray
            isVisible={showTray && hasMessages}
            onReset={onResetConversation}
            onCopyConversation={handleCopyConversation}
          />

          {/* Text Input Area */}
          <TextInputArea
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={onStopGenerating}
            isGenerating={isGenerating}
            isModelLoaded={isModelLoaded}
          />
        </div>
      </div>
    );
  }
);

ChatView.displayName = 'ChatView';

/* ============================================================================
   Empty State Component
   ============================================================================ */

interface EmptyStateProps {
  isModelLoaded: boolean;
}

const EmptyState = ({ isModelLoaded }: EmptyStateProps) => {
  return (
    <div
      className={cn(
        'absolute top-0 left-0',
        'w-full h-full',
        'z-[200]',
        'flex flex-col items-center justify-center',
        'bg-[var(--bg-conversation)]'
      )}
    >
      {/* YouWorker Logo */}
      <div
        className={cn(
          'w-[160px] h-[110px]',
          'mb-[30px]',
          'flex items-center justify-center',
          'bg-[var(--bg-lighter-button)]',
          'rounded-[var(--radius-standard)]'
        )}
      >
        <span
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-banner)]', // 24pt / ~32px
            'font-bold',
            'text-[var(--text-color)]'
          )}
        >
          YouWorker
        </span>
      </div>

      {/* Message or Button */}
      {!isModelLoaded ? (
        <>
          <p
            className={cn(
              'font-[family-name:var(--font-primary)] text-[length:var(--font-larger)]', // 14pt / ~18.7px
              'text-[var(--text-muted)]',
              'text-center',
              'mb-[20px]'
            )}
          >
            No model loaded
          </p>
          <button
            className={cn(
              'px-[30px] py-[15px]',
              'bg-[var(--bg-button)]',
              'text-[var(--text-opposite)]',
              'rounded-[var(--radius-standard)]',
              'font-[family-name:var(--font-primary)] text-[length:var(--font-large)]',
              'font-bold',
              'cursor-pointer',
              'transition-colors duration-[var(--duration-standard)]',
              'hover:bg-[var(--bg-button-hover)]'
            )}
          >
            Load Model
          </button>
        </>
      ) : (
        <p
          className={cn(
            'font-[family-name:var(--font-primary)] text-[length:var(--font-larger)]',
            'text-[var(--text-muted)]',
            'text-center'
          )}
        >
          Start a conversation by typing a message below
        </p>
      )}
    </div>
  );
};

/* ============================================================================
   Virtualized Chat View (for performance with many messages)
   ============================================================================

   NOTE: Virtualized view is commented out for now.
   We can add react-window virtualization later for performance with 1000+ messages.
   For most use cases, the standard scroll view will work fine.
   ============================================================================ */
