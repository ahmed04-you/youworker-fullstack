/**
 * MainLayout - Three-panel responsive layout container
 *
 * Layout Structure:
 * - Left Panel (ChatDrawer): 180-600px, 23% max-width, always visible (toggles to min)
 * - Center Panel (Main Content): Flexible width, max 1280px content
 * - Right Panel (CollectionsDrawer): 180-600px, 23% max-width, toggleable (hidden by default)
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';
import { useChatStore } from '@/lib/stores/chat-store';
import { motion } from 'framer-motion';

interface MainLayoutProps {
  chatDrawer: React.ReactNode;
  collectionsDrawer: React.ReactNode;
  children: React.ReactNode;
}

export function MainLayout({
  chatDrawer,
  collectionsDrawer,
  children,
}: MainLayoutProps) {
  const isLeftDrawerOpen = useChatStore(state => state.isLeftDrawerOpen);
  const isRightDrawerOpen = useChatStore(state => state.isRightDrawerOpen);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-view)]">
      {/* Left Panel - ChatDrawer */}
      <motion.div
        initial={false}
        animate={{
          width: isLeftDrawerOpen ? 'min(23vw, 600px)' : '180px',
        }}
        transition={{
          duration: 0.2,
          ease: [0.45, 0, 0.55, 1], // cubic-bezier easing
        }}
        className={cn(
          'relative flex-shrink-0',
          'border-r border-[var(--border-divider)]',
          'bg-[var(--bg-view)]',
          'overflow-hidden'
        )}
        style={{
          minWidth: '180px',
          maxWidth: '600px',
        }}
      >
        {chatDrawer}
      </motion.div>

      {/* Center Panel - Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-conversation)]">
        {children}
      </div>

      {/* Right Panel - CollectionsDrawer */}
      {isRightDrawerOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{
            width: 'min(23vw, 600px)',
            opacity: 1,
          }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            duration: 0.3,
            ease: [0.45, 0, 0.55, 1], // cubic-bezier easing
          }}
          className={cn(
            'relative flex-shrink-0',
            'border-l border-[var(--border-divider)]',
            'bg-[var(--bg-view)]',
            'overflow-hidden'
          )}
          style={{
            minWidth: '180px',
            maxWidth: '600px',
          }}
        >
          {collectionsDrawer}
        </motion.div>
      )}
    </div>
  );
}
