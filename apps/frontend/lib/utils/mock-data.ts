/**
 * Mock Data for YouWorker Frontend
 * Used for UI development and testing
 */

// ============================================================================
// Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelName?: string;
  status?: 'retrieving' | 'processing' | 'generating' | 'complete';
  attachments?: Attachment[];
  sources?: Source[];
  suggestedFollowUps?: string[];
  thumbsUp?: boolean;
  thumbsDown?: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  type: string;
  path: string;
}

export interface Source {
  id: string;
  title: string;
  excerpt: string;
  file?: string;
  page?: number;
  collection?: string;
}

export interface Chat {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

export interface Collection {
  id: string;
  name: string;
  path: string;
  filesCount: number;
  wordsCount: number;
  embeddingModel: string;
  lastUpdate: Date;
  isUpdating: boolean;
  isEnabled: boolean;
  currentFile?: string;
  status?: 'idle' | 'updating' | 'error' | 'success';
  statusMessage?: string;
}

// ============================================================================
// Mock Chats
// ============================================================================

export const mockChats: Chat[] = [
  {
    id: '1',
    name: 'React Best Practices',
    createdAt: new Date('2024-10-30T10:00:00'),
    updatedAt: new Date('2024-10-31T14:30:00'),
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'What are the best practices for React component design?',
        timestamp: new Date('2024-10-30T10:00:00'),
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `When designing React components, there are several key best practices to follow:

1. **Single Responsibility Principle**: Each component should do one thing well. If a component is doing too much, break it into smaller components.

2. **Composition over Inheritance**: React recommends using composition to reuse code between components rather than relying on inheritance.

3. **Keep Components Small**: Smaller components are easier to understand, test, and maintain. Aim for components under 100 lines when possible.

4. **Use Functional Components**: With React Hooks, functional components can do everything class components can, with cleaner syntax and better reusability.

5. **Proper State Management**: Keep state as local as possible. Only lift state up when multiple components need to share it.

6. **PropTypes or TypeScript**: Add type checking to catch bugs early and provide better documentation.

Would you like me to elaborate on any of these points?`,
        timestamp: new Date('2024-10-30T10:00:15'),
        modelName: 'GPT-4',
        status: 'complete',
        sources: [
          {
            id: 's1',
            title: 'React Official Documentation',
            excerpt: 'Components let you split the UI into independent, reusable pieces...',
            file: 'react-docs.pdf',
            page: 12,
            collection: 'React Documentation',
          },
          {
            id: 's2',
            title: 'Thinking in React',
            excerpt: 'Start with a mock and break the UI into a component hierarchy...',
            file: 'thinking-in-react.md',
            collection: 'React Documentation',
          },
        ],
        suggestedFollowUps: [
          'How do I implement custom hooks?',
          'What are the best practices for state management?',
          'Can you explain React component lifecycle?',
        ],
      },
      {
        id: 'm3',
        role: 'user',
        content: 'Yes, can you tell me more about custom hooks?',
        timestamp: new Date('2024-10-31T14:30:00'),
      },
    ],
  },
  {
    id: '2',
    name: 'Python Data Analysis',
    createdAt: new Date('2024-10-29T09:15:00'),
    updatedAt: new Date('2024-10-29T09:45:00'),
    messages: [
      {
        id: 'm4',
        role: 'user',
        content: 'How do I read a CSV file in pandas?',
        timestamp: new Date('2024-10-29T09:15:00'),
      },
      {
        id: 'm5',
        role: 'assistant',
        content: `To read a CSV file in pandas, you can use the \`pd.read_csv()\` function:

\`\`\`python
import pandas as pd

# Basic usage
df = pd.read_csv('data.csv')

# With additional parameters
df = pd.read_csv(
    'data.csv',
    sep=',',           # Delimiter (default is comma)
    header=0,          # Row number to use as column names
    index_col=0,       # Column to use as row labels
    usecols=['A', 'B'] # Only read specific columns
)
\`\`\`

The function returns a DataFrame object that you can then manipulate and analyze.`,
        timestamp: new Date('2024-10-29T09:15:20'),
        modelName: 'Llama 3.1',
        status: 'complete',
        suggestedFollowUps: [
          'How do I handle missing values in pandas?',
          'What are some common DataFrame operations?',
        ],
      },
    ],
  },
  {
    id: '3',
    name: 'TypeScript Generics',
    createdAt: new Date('2024-10-28T15:20:00'),
    updatedAt: new Date('2024-10-28T15:20:00'),
    messages: [],
  },
  {
    id: '4',
    name: 'Machine Learning Basics',
    createdAt: new Date('2024-10-27T11:00:00'),
    updatedAt: new Date('2024-10-27T11:30:00'),
    messages: [
      {
        id: 'm6',
        role: 'user',
        content: 'What is the difference between supervised and unsupervised learning?',
        timestamp: new Date('2024-10-27T11:00:00'),
      },
    ],
  },
  {
    id: '5',
    name: 'Docker Container Management',
    createdAt: new Date('2024-10-26T14:10:00'),
    updatedAt: new Date('2024-10-26T14:10:00'),
    messages: [],
  },
  {
    id: '6',
    name: 'SQL Query Optimization',
    createdAt: new Date('2024-10-25T16:45:00'),
    updatedAt: new Date('2024-10-25T16:45:00'),
    messages: [],
  },
];

// ============================================================================
// Mock Messages (for current chat)
// ============================================================================

export const mockMessages: Message[] = [
  {
    id: 'm1',
    role: 'user',
    content: 'What is React?',
    timestamp: new Date('2024-10-31T10:00:00'),
  },
  {
    id: 'm2',
    role: 'assistant',
    content: `React is a JavaScript library for building user interfaces, developed and maintained by Facebook. It's designed to make it easy to create interactive, stateful, and reusable UI components.

Key features of React include:

- **Component-Based Architecture**: Build encapsulated components that manage their own state
- **Virtual DOM**: Efficiently update and render only the components that need to change
- **Declarative**: Makes your code more predictable and easier to debug
- **Learn Once, Write Anywhere**: Can be used for web, mobile (React Native), and even VR applications`,
    timestamp: new Date('2024-10-31T10:00:15'),
    modelName: 'GPT-4',
    status: 'complete',
    sources: [
      {
        id: 's1',
        title: 'React Official Documentation',
        excerpt: 'React is a JavaScript library for building user interfaces. Learn what React is all about on our homepage or in the tutorial.',
        file: 'react-docs.pdf',
        page: 1,
        collection: 'Project Documentation',
      },
      {
        id: 's2',
        title: 'Getting Started with React',
        excerpt: 'This page is an overview of the React documentation and related resources. React is a JavaScript library for building user interfaces...',
        file: 'getting-started.md',
        collection: 'Project Documentation',
      },
      {
        id: 's3',
        title: 'React Philosophy',
        excerpt: 'We think React makes it painless to create interactive UIs. Design simple views for each state in your application...',
        file: 'philosophy.md',
        collection: 'Project Documentation',
      },
    ],
    suggestedFollowUps: [
      'What are React hooks?',
      'How do I get started with React?',
      'What is the difference between React and Vue?',
    ],
  },
  {
    id: 'm3',
    role: 'user',
    content: 'Can you show me a simple React component example?',
    timestamp: new Date('2024-10-31T10:01:00'),
    attachments: [
      {
        id: 'a1',
        filename: 'example.jsx',
        size: 1024,
        type: 'application/javascript',
        path: '/uploads/example.jsx',
      },
    ],
  },
  {
    id: 'm4',
    role: 'assistant',
    content: `Here's a simple React component example:

\`\`\`jsx
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
      <button onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}

export default Counter;
\`\`\`

This component demonstrates:
- Using the \`useState\` hook for state management
- Event handling with onClick
- JSX syntax for rendering UI
- Functional component pattern

The component maintains a count state and provides buttons to increment, decrement, or reset the count.`,
    timestamp: new Date('2024-10-31T10:01:20'),
    modelName: 'GPT-4',
    status: 'complete',
    suggestedFollowUps: [
      'How do I add styling to this component?',
      'Can you explain the useState hook in more detail?',
      'What are other commonly used React hooks?',
    ],
    thumbsUp: true,
  },
];

// ============================================================================
// Mock Collections
// ============================================================================

export const mockCollections: Collection[] = [
  {
    id: 'c1',
    name: 'Project Documentation',
    path: '/home/user/Documents/project-docs',
    filesCount: 1523,
    wordsCount: 234567,
    embeddingModel: 'all-MiniLM-L6-v2',
    lastUpdate: new Date('2024-10-30T15:30:00'),
    isUpdating: false,
    isEnabled: true,
    status: 'idle',
    statusMessage: 'Up to date',
  },
  {
    id: 'c2',
    name: 'Research Papers',
    path: '/home/user/Documents/research',
    filesCount: 87,
    wordsCount: 145890,
    embeddingModel: 'all-MiniLM-L6-v2',
    lastUpdate: new Date('2024-10-28T09:15:00'),
    isUpdating: true,
    isEnabled: true,
    currentFile: 'neural-networks-2024.pdf',
    status: 'updating',
    statusMessage: 'Indexing files...',
  },
  {
    id: 'c3',
    name: 'Code Snippets',
    path: '/home/user/code/snippets',
    filesCount: 342,
    wordsCount: 52341,
    embeddingModel: 'nomic-embed-text-v1.5',
    lastUpdate: new Date('2024-10-25T11:20:00'),
    isUpdating: false,
    isEnabled: false,
    status: 'idle',
  },
  {
    id: 'c4',
    name: 'Meeting Notes',
    path: '/home/user/Documents/meetings',
    filesCount: 215,
    wordsCount: 98234,
    embeddingModel: 'all-MiniLM-L6-v2',
    lastUpdate: new Date('2024-10-31T08:00:00'),
    isUpdating: false,
    isEnabled: true,
    status: 'success',
    statusMessage: 'Successfully updated',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getMockChatById(id: string): Chat | undefined {
  return mockChats.find(chat => chat.id === id);
}

export function getMockMessagesByChatId(chatId: string): Message[] {
  const chat = getMockChatById(chatId);
  return chat?.messages || [];
}

export function getMockCollectionById(id: string): Collection | undefined {
  return mockCollections.find(collection => collection.id === id);
}

export function getEnabledCollections(): Collection[] {
  return mockCollections.filter(collection => collection.isEnabled);
}

export function getEnabledCollectionsCount(): number {
  return getEnabledCollections().length;
}
