/**
 * Header Component
 *
 * Specifications:
 * - Height: 100px
 * - Components (left to right):
 *   1. Drawer toggle button (40×40px)
 *   2. Application title "YouWorker" (or logo)
 *   3. LocalDocs button (with badge/spinner states)
 */

'use client';

import React from 'react';
import { Menu, X, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useChatStore } from '@/lib/stores/chat-store';
import { getEnabledCollectionsCount } from '@/lib/utils/mock-data';

export function Header() {
  const isLeftDrawerOpen = useChatStore(state => state.isLeftDrawerOpen);
  const isRightDrawerOpen = useChatStore(state => state.isRightDrawerOpen);
  const toggleLeftDrawer = useChatStore(state => state.toggleLeftDrawer);
  const toggleRightDrawer = useChatStore(state => state.toggleRightDrawer);

  const enabledCollectionsCount = getEnabledCollectionsCount();

  // Mock states for demo purposes
  const isUpdatingCollections = false; // In real app, get from collections store

  return (
    <header
      className={cn(
        'flex h-[100px] w-full items-center justify-between',
        'px-[30px]',
        'border-b border-[var(--border-divider)]',
        'bg-[var(--bg-conversation)]'
      )}
    >
      {/* Left Section: Drawer Toggle + Title */}
      <div className="flex items-center gap-[15px]">
        {/* Drawer Toggle Button */}
        <button
          onClick={toggleLeftDrawer}
          className={cn(
            'flex h-[40px] w-[40px] items-center justify-center',
            'rounded-[var(--radius-standard)]',
            'bg-[var(--bg-lighter-button)]',
            'text-[var(--text-color)]',
            'transition-opacity duration-[var(--duration-standard)]',
            'hover:opacity-80',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
            'focus-visible:outline-offset-2'
          )}
          aria-label={isLeftDrawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isLeftDrawerOpen ? (
            <X size={24} className="flex-shrink-0" />
          ) : (
            <Menu size={24} className="flex-shrink-0" />
          )}
        </button>

        {/* Application Title/Logo */}
        <div className="flex items-center gap-[10px]">
          {/* Logo would go here - for now using text */}
          <h1
            className={cn(
              'text-[var(--font-larger)] font-bold',
              'text-[var(--text-color)]',
              'select-none'
            )}
          >
            YouWorker
          </h1>
        </div>
      </div>

      {/* Right Section: LocalDocs Button */}
      <div className="flex items-center">
        <button
          onClick={toggleRightDrawer}
          className={cn(
            'relative flex items-center gap-[10px]',
            'px-[18px] py-[10px]',
            'rounded-[var(--radius-standard)]',
            'text-[var(--font-large)] font-bold',
            'transition-all duration-[var(--duration-standard)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
            'focus-visible:outline-offset-2',
            // Background color changes based on active state
            isRightDrawerOpen
              ? 'bg-[var(--bg-collections-button)] text-[var(--text-color)]'
              : 'bg-[var(--bg-lighter-button)] text-[var(--text-color)] hover:opacity-90'
          )}
          aria-label={isRightDrawerOpen ? 'Close LocalDocs' : 'Open LocalDocs'}
          aria-pressed={isRightDrawerOpen}
        >
          {/* Icon or Spinner */}
          {isUpdatingCollections ? (
            <Loader2
              size={24}
              className="animate-spin text-[var(--accent-color)]"
            />
          ) : (
            <FileText size={24} />
          )}

          <span>LocalDocs</span>

          {/* Badge with count (if collections are enabled) */}
          {enabledCollectionsCount > 0 && !isUpdatingCollections && (
            <div
              className={cn(
                'flex h-[20px] min-w-[20px] items-center justify-center',
                'rounded-full',
                'bg-[var(--accent-color)]',
                'px-[6px]',
                'text-[var(--font-smaller)] font-bold',
                'text-[var(--text-opposite)]'
              )}
            >
              {enabledCollectionsCount}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}
