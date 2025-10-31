/**
 * Chat Store - Zustand state management for chat functionality
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Chat,
  Message,
  mockChats,
  mockMessages,
  getMockChatById,
  getMockMessagesByChatId
} from '@/lib/utils/mock-data';

// ============================================================================
// Types
// ============================================================================

interface ChatState {
  // Chat list state
  chats: Chat[];
  currentChatId: string | null;

  // Drawer state
  isLeftDrawerOpen: boolean;
  isRightDrawerOpen: boolean;

  // Message state
  messages: Message[];
  isGenerating: boolean;
  inputText: string;

  // Actions - Chat management
  setCurrentChat: (chatId: string | null) => void;
  createNewChat: () => void;
  renameChat: (chatId: string, newName: string) => void;
  deleteChat: (chatId: string) => void;

  // Actions - Drawer management
  toggleLeftDrawer: () => void;
  toggleRightDrawer: () => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;

  // Actions - Message management
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;

  // Actions - Input management
  setInputText: (text: string) => void;
  setIsGenerating: (generating: boolean) => void;

  // Actions - Feedback
  setMessageThumbsUp: (messageId: string) => void;
  setMessageThumbsDown: (messageId: string) => void;

  // Actions - Initialize
  loadMockData: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      chats: [],
      currentChatId: null,
      isLeftDrawerOpen: true,
      isRightDrawerOpen: false,
      messages: [],
      isGenerating: false,
      inputText: '',

      // Chat management
      setCurrentChat: (chatId) => {
        set({ currentChatId: chatId });
        if (chatId) {
          const chat = get().chats.find(c => c.id === chatId);
          set({ messages: chat?.messages || [] });
        } else {
          set({ messages: [] });
        }
      },

      createNewChat: () => {
        const newChat: Chat = {
          id: `chat-${Date.now()}`,
          name: 'New Chat',
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        };
        set(state => ({
          chats: [newChat, ...state.chats],
          currentChatId: newChat.id,
          messages: [],
        }));
      },

      renameChat: (chatId, newName) => {
        set(state => ({
          chats: state.chats.map(chat =>
            chat.id === chatId
              ? { ...chat, name: newName, updatedAt: new Date() }
              : chat
          ),
        }));
      },

      deleteChat: (chatId) => {
        set(state => {
          const newChats = state.chats.filter(chat => chat.id !== chatId);
          const newCurrentChatId = state.currentChatId === chatId
            ? (newChats.length > 0 ? newChats[0].id : null)
            : state.currentChatId;

          return {
            chats: newChats,
            currentChatId: newCurrentChatId,
            messages: newCurrentChatId
              ? newChats.find(c => c.id === newCurrentChatId)?.messages || []
              : [],
          };
        });
      },

      // Drawer management
      toggleLeftDrawer: () => {
        set(state => ({ isLeftDrawerOpen: !state.isLeftDrawerOpen }));
      },

      toggleRightDrawer: () => {
        set(state => ({ isRightDrawerOpen: !state.isRightDrawerOpen }));
      },

      setLeftDrawerOpen: (open) => {
        set({ isLeftDrawerOpen: open });
      },

      setRightDrawerOpen: (open) => {
        set({ isRightDrawerOpen: open });
      },

      // Message management
      addMessage: (message) => {
        set(state => {
          const newMessages = [...state.messages, message];

          // Also update the chat's messages
          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: newMessages, updatedAt: new Date() }
              : chat
          );

          // Auto-rename chat if it's the first user message and chat name is "New Chat"
          const currentChat = state.chats.find(c => c.id === state.currentChatId);
          if (
            currentChat?.name === 'New Chat' &&
            message.role === 'user' &&
            newMessages.filter(m => m.role === 'user').length === 1
          ) {
            const newName = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
            updatedChats.forEach(chat => {
              if (chat.id === state.currentChatId) {
                chat.name = newName;
              }
            });
          }

          return {
            messages: newMessages,
            chats: updatedChats,
          };
        });
      },

      updateMessage: (messageId, updates) => {
        set(state => {
          const newMessages = state.messages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );

          // Also update the chat's messages
          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: newMessages, updatedAt: new Date() }
              : chat
          );

          return {
            messages: newMessages,
            chats: updatedChats,
          };
        });
      },

      deleteMessage: (messageId) => {
        set(state => {
          const newMessages = state.messages.filter(msg => msg.id !== messageId);

          // Also update the chat's messages
          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: newMessages, updatedAt: new Date() }
              : chat
          );

          return {
            messages: newMessages,
            chats: updatedChats,
          };
        });
      },

      clearMessages: () => {
        set(state => {
          // Also update the chat's messages
          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: [], updatedAt: new Date() }
              : chat
          );

          return {
            messages: [],
            chats: updatedChats,
          };
        });
      },

      // Input management
      setInputText: (text) => {
        set({ inputText: text });
      },

      setIsGenerating: (generating) => {
        set({ isGenerating: generating });
      },

      // Feedback
      setMessageThumbsUp: (messageId) => {
        set(state => {
          const newMessages = state.messages.map(msg =>
            msg.id === messageId
              ? { ...msg, thumbsUp: !msg.thumbsUp, thumbsDown: false }
              : msg
          );

          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: newMessages }
              : chat
          );

          return {
            messages: newMessages,
            chats: updatedChats,
          };
        });
      },

      setMessageThumbsDown: (messageId) => {
        set(state => {
          const newMessages = state.messages.map(msg =>
            msg.id === messageId
              ? { ...msg, thumbsDown: !msg.thumbsDown, thumbsUp: false }
              : msg
          );

          const updatedChats = state.chats.map(chat =>
            chat.id === state.currentChatId
              ? { ...chat, messages: newMessages }
              : chat
          );

          return {
            messages: newMessages,
            chats: updatedChats,
          };
        });
      },

      // Initialize with mock data
      loadMockData: () => {
        set({
          chats: mockChats,
          currentChatId: mockChats.length > 0 ? mockChats[0].id : null,
          messages: mockChats.length > 0 ? mockChats[0].messages : [],
        });
      },
    }),
    {
      name: 'youworker-chat-storage',
      // Only persist certain fields
      partialize: (state) => ({
        chats: state.chats,
        currentChatId: state.currentChatId,
        isLeftDrawerOpen: state.isLeftDrawerOpen,
        isRightDrawerOpen: state.isRightDrawerOpen,
      }),
    }
  )
);

// ============================================================================
// Custom Hooks
// ============================================================================

export function useCurrentChat() {
  const currentChatId = useChatStore(state => state.currentChatId);
  const chats = useChatStore(state => state.chats);
  return chats.find(chat => chat.id === currentChatId) || null;
}

export function useMessages() {
  return useChatStore(state => state.messages);
}

export function useChatActions() {
  return {
    setCurrentChat: useChatStore(state => state.setCurrentChat),
    createNewChat: useChatStore(state => state.createNewChat),
    renameChat: useChatStore(state => state.renameChat),
    deleteChat: useChatStore(state => state.deleteChat),
    addMessage: useChatStore(state => state.addMessage),
    updateMessage: useChatStore(state => state.updateMessage),
    deleteMessage: useChatStore(state => state.deleteMessage),
    clearMessages: useChatStore(state => state.clearMessages),
    setInputText: useChatStore(state => state.setInputText),
    setIsGenerating: useChatStore(state => state.setIsGenerating),
    setMessageThumbsUp: useChatStore(state => state.setMessageThumbsUp),
    setMessageThumbsDown: useChatStore(state => state.setMessageThumbsDown),
    loadMockData: useChatStore(state => state.loadMockData),
  };
}
