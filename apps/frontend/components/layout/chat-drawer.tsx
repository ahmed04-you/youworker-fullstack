/**
 * ChatDrawer - Left Sidebar with Chat List
 *
 * Specifications:
 * - "New Chat" button at top (24px vertical, 20px horizontal padding)
 * - Scrollable chat list with virtualization
 * - Each chat item has edit/delete buttons
 * - Section headers for organization
 * - Confirmation popup for delete (3s auto-dismiss)
 */

'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useChatStore } from '@/lib/stores/chat-store';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatListItemProps {
  chatId: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function ChatListItem({
  chatId,
  name,
  isSelected,
  onSelect,
  onRename,
  onDelete,
}: ChatListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedName(name);
  };

  const handleSaveEdit = () => {
    if (editedName.trim()) {
      onRename(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setShowDeleteConfirm(false);
    }, 3000);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className={cn(
        'group relative flex items-center gap-[10px]',
        'px-[20px] py-[12px]',
        'cursor-pointer',
        'transition-colors duration-[var(--duration-quick)]',
        isSelected && 'bg-[var(--bg-selected)]'
      )}
      onClick={!isEditing ? onSelect : undefined}
    >
      {/* Chat Name */}
      {isEditing ? (
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveEdit();
            if (e.key === 'Escape') handleCancelEdit();
          }}
          onBlur={handleSaveEdit}
          className={cn(
            'flex-1',
            'bg-transparent',
            'text-[var(--font-large)] font-bold',
            'text-[var(--text-color)]',
            'border-b-2 border-[var(--accent-color)]',
            'outline-none',
            'px-[2px]'
          )}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className={cn(
            'flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
            'text-[var(--font-large)] font-bold',
            'text-[var(--text-color)]'
          )}
        >
          {name}
        </div>
      )}

      {/* Action Buttons */}
      {!showDeleteConfirm && (
        <div className="flex items-center gap-[8px]">
          {/* Edit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
            className={cn(
              'flex h-[24px] w-[24px] items-center justify-center',
              'text-[var(--text-muted)]',
              'transition-opacity duration-[var(--duration-quick)]',
              'opacity-0 group-hover:opacity-100',
              'hover:text-[var(--text-color)]',
              'focus-visible:opacity-100'
            )}
            aria-label={`Edit ${name}`}
          >
            <Pencil size={16} />
          </button>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className={cn(
              'flex h-[24px] w-[24px] items-center justify-center',
              'text-[var(--text-muted)]',
              'transition-opacity duration-[var(--duration-quick)]',
              'opacity-0 group-hover:opacity-100',
              'hover:text-[var(--error-color)]',
              'focus-visible:opacity-100'
            )}
            aria-label={`Delete ${name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute right-[20px] top-1/2 -translate-y-1/2',
              'flex items-center gap-[8px]',
              'rounded-[var(--radius-small)]',
              'bg-[var(--bg-control)]',
              'px-[12px] py-[6px]',
              'shadow-lg',
              'border border-[var(--border-control)]',
              'z-10'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confirm Button */}
            <button
              onClick={handleConfirmDelete}
              className={cn(
                'flex h-[24px] w-[24px] items-center justify-center',
                'text-[var(--error-color)]',
                'hover:opacity-80'
              )}
              aria-label="Confirm delete"
            >
              <Check size={18} />
            </button>

            {/* Cancel Button */}
            <button
              onClick={handleCancelDelete}
              className={cn(
                'flex h-[24px] w-[24px] items-center justify-center',
                'text-[var(--text-color)]',
                'hover:opacity-80'
              )}
              aria-label="Cancel delete"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatDrawer() {
  const chats = useChatStore(state => state.chats);
  const currentChatId = useChatStore(state => state.currentChatId);
  const isLeftDrawerOpen = useChatStore(state => state.isLeftDrawerOpen);
  const createNewChat = useChatStore(state => state.createNewChat);
  const setCurrentChat = useChatStore(state => state.setCurrentChat);
  const renameChat = useChatStore(state => state.renameChat);
  const deleteChat = useChatStore(state => state.deleteChat);

  // Group chats by date (Today, Yesterday, This Week, etc.)
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groupedChats = {
    today: chats.filter(chat => chat.updatedAt >= new Date(today.setHours(0, 0, 0, 0))),
    yesterday: chats.filter(chat => {
      const chatDate = chat.updatedAt;
      return chatDate < new Date(today.setHours(0, 0, 0, 0)) &&
             chatDate >= new Date(yesterday.setHours(0, 0, 0, 0));
    }),
    thisWeek: chats.filter(chat => {
      const chatDate = chat.updatedAt;
      return chatDate < new Date(yesterday.setHours(0, 0, 0, 0)) &&
             chatDate >= weekAgo;
    }),
    older: chats.filter(chat => chat.updatedAt < weekAgo),
  };

  return (
    <div className="flex h-full flex-col">
      {/* New Chat Button */}
      <button
        onClick={createNewChat}
        className={cn(
          'flex items-center gap-[10px]',
          'px-[20px] py-[24px]',
          'text-left',
          'text-[var(--font-large)] font-bold',
          'text-[var(--text-color)]',
          'bg-transparent',
          'transition-colors duration-[var(--duration-standard)]',
          'hover:bg-[var(--bg-lighter-button)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
          'focus-visible:outline-offset-[-2px]'
        )}
        aria-label="Create new chat"
      >
        <Plus size={24} />
        {isLeftDrawerOpen && <span>New Chat</span>}
      </button>

      {/* Divider */}
      <div className="h-[1px] bg-[var(--border-divider)]" />

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Today */}
        {groupedChats.today.length > 0 && (
          <>
            {isLeftDrawerOpen && (
              <div
                className={cn(
                  'px-[20px] py-[10px]',
                  'text-[var(--font-smaller)]',
                  'text-[var(--text-muted)]'
                )}
              >
                Today
              </div>
            )}
            {groupedChats.today.map(chat => (
              <ChatListItem
                key={chat.id}
                chatId={chat.id}
                name={chat.name}
                isSelected={chat.id === currentChatId}
                onSelect={() => setCurrentChat(chat.id)}
                onRename={(newName) => renameChat(chat.id, newName)}
                onDelete={() => deleteChat(chat.id)}
              />
            ))}
          </>
        )}

        {/* Yesterday */}
        {groupedChats.yesterday.length > 0 && (
          <>
            {isLeftDrawerOpen && (
              <div
                className={cn(
                  'px-[20px] py-[10px]',
                  'text-[var(--font-smaller)]',
                  'text-[var(--text-muted)]'
                )}
              >
                Yesterday
              </div>
            )}
            {groupedChats.yesterday.map(chat => (
              <ChatListItem
                key={chat.id}
                chatId={chat.id}
                name={chat.name}
                isSelected={chat.id === currentChatId}
                onSelect={() => setCurrentChat(chat.id)}
                onRename={(newName) => renameChat(chat.id, newName)}
                onDelete={() => deleteChat(chat.id)}
              />
            ))}
          </>
        )}

        {/* This Week */}
        {groupedChats.thisWeek.length > 0 && (
          <>
            {isLeftDrawerOpen && (
              <div
                className={cn(
                  'px-[20px] py-[10px]',
                  'text-[var(--font-smaller)]',
                  'text-[var(--text-muted)]'
                )}
              >
                This Week
              </div>
            )}
            {groupedChats.thisWeek.map(chat => (
              <ChatListItem
                key={chat.id}
                chatId={chat.id}
                name={chat.name}
                isSelected={chat.id === currentChatId}
                onSelect={() => setCurrentChat(chat.id)}
                onRename={(newName) => renameChat(chat.id, newName)}
                onDelete={() => deleteChat(chat.id)}
              />
            ))}
          </>
        )}

        {/* Older */}
        {groupedChats.older.length > 0 && (
          <>
            {isLeftDrawerOpen && (
              <div
                className={cn(
                  'px-[20px] py-[10px]',
                  'text-[var(--font-smaller)]',
                  'text-[var(--text-muted)]'
                )}
              >
                Older
              </div>
            )}
            {groupedChats.older.map(chat => (
              <ChatListItem
                key={chat.id}
                chatId={chat.id}
                name={chat.name}
                isSelected={chat.id === currentChatId}
                onSelect={() => setCurrentChat(chat.id)}
                onRename={(newName) => renameChat(chat.id, newName)}
                onDelete={() => deleteChat(chat.id)}
              />
            ))}
          </>
        )}

        {/* Empty State */}
        {chats.length === 0 && (
          <div
            className={cn(
              'flex items-center justify-center',
              'px-[20px] py-[40px]',
              'text-[var(--font-medium)]',
              'text-[var(--text-muted)]',
              'text-center'
            )}
          >
            {isLeftDrawerOpen
              ? 'No chats yet. Click "New Chat" to start!'
              : 'No chats'}
          </div>
        )}
      </div>
    </div>
  );
}
