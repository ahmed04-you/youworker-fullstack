/**
 * Chat Page - Main chat interface
 */

'use client';

import React, { useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Header } from '@/components/layout/header';
import { ChatDrawer } from '@/components/layout/chat-drawer';
import { CollectionsDrawer } from '@/components/layout/collections-drawer';
import { ChatView } from '@/components/chat/chat-view';
import { useChatStore } from '@/lib/stores/chat-store';

export default function ChatPage() {
  const loadMockData = useChatStore(state => state.loadMockData);
  const messages = useChatStore(state => state.messages);
  const addMessage = useChatStore(state => state.addMessage);
  const clearMessages = useChatStore(state => state.clearMessages);

  // Load mock data on mount
  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  const handleSendMessage = (content: string) => {
    // Add user message
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    });

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      addMessage({
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: 'This is a simulated AI response. In production, this would come from your backend API.',
        timestamp: new Date(),
        modelName: 'GPT-4',
        suggestedFollowUps: [
          'Tell me more about this',
          'Can you explain that differently?',
          'What are the alternatives?',
        ],
      });
    }, 1000);
  };

  const handleResetConversation = () => {
    clearMessages();
  };

  const handleCopyConversation = () => {
    // Toast notification would be shown here
    console.log('Conversation copied to clipboard');
  };

  return (
    <MainLayout
      chatDrawer={<ChatDrawer />}
      collectionsDrawer={<CollectionsDrawer />}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <Header />

        {/* Chat View */}
        <ChatView
          messages={messages}
          onSendMessage={handleSendMessage}
          onResetConversation={handleResetConversation}
          onCopyConversation={handleCopyConversation}
          isModelLoaded={true}
        />
      </div>
    </MainLayout>
  );
}
