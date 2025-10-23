import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/shell/navbar'

jest.mock('@/lib/i18n', () => {
  const translations: Record<string, string> = {
    'nav.new_chat': 'Nuova chat',
    'nav.upload': 'Carica file',
    'nav.chat': 'Chat',
    'nav.history': 'Cronologia',
    'nav.settings': 'Impostazioni',
    'nav.api_status.online': 'API Online',
    'nav.api_status.offline': 'API Offline',
    'chat.title': 'YouWorker.AI',
  }

  return {
    useI18n: () => ({
      t: (key: string) => translations[key] ?? key,
      language: 'it',
      setLanguage: jest.fn(),
      availableLanguages: [],
    }),
  }
})

// Mock the hooks
jest.mock('@/lib/hooks', () => ({
  useHealthSWR: jest.fn(() => ({
    data: {
      status: 'healthy',
      components: {
        voice: { mode: 'turn_based', stt_available: true, tts_available: true },
        mcp_servers: { healthy: [], unhealthy: [], total: 0 },
        database: 'connected',
        agent: 'ready',
        ollama: { base_url: 'http://localhost:11434', auto_pull: true, ready: true, models: {}, missing: [] }
      }
    },
    error: null
  })),
}))

jest.mock('@/lib/hooks/use-motion-preference', () => ({
  useMotionPreference: () => false
}))

jest.mock('@/lib/mode', () => ({
  useChatSettings: () => ({
    expectAudio: true,
    setExpectAudio: jest.fn(),
    toggleExpectAudio: jest.fn(),
    assistantLanguage: 'it',
    setAssistantLanguage: jest.fn(),
    uiLanguage: 'it',
    setUiLanguage: jest.fn()
  })
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn()
  })),
  usePathname: jest.fn(() => '/')
}))

jest.mock('@/lib/contexts/chat-context', () => {
  const actual = jest.requireActual('@/lib/contexts/chat-context')
  return {
    ...actual,
    useChatContext: jest.fn(),
  }
})

const useChatContextMock = require('@/lib/contexts/chat-context').useChatContext as jest.Mock
const useHealthSWRMock = require('@/lib/hooks').useHealthSWR as jest.Mock
const nextNavigation = require('next/navigation') as { useRouter: jest.Mock; usePathname: jest.Mock }

const defaultHealthResponse = {
  status: 'healthy',
  components: {
    voice: { mode: 'turn_based', stt_available: true, tts_available: true },
    mcp_servers: { healthy: [], unhealthy: [], total: 0 },
    database: 'connected',
    agent: 'ready',
    ollama: { base_url: 'http://localhost:11434', auto_pull: true, ready: true, models: {}, missing: [] },
  },
}

beforeEach(() => {
  useChatContextMock.mockReturnValue({ clearChat: jest.fn() })
  useHealthSWRMock.mockReturnValue({ data: defaultHealthResponse, error: null })
  nextNavigation.useRouter.mockReturnValue({ push: jest.fn() })
  nextNavigation.usePathname.mockReturnValue('/')
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('Navbar', () => {
  it('renders navigation items', () => {
    render(<Navbar />)

    // Check for navigation items via accessible labels
    expect(screen.getByText('Nuova chat')).toBeInTheDocument()
    expect(screen.getByText('Carica file')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Cronologia')).toBeInTheDocument()
    expect(screen.getByText('Impostazioni')).toBeInTheDocument()
  })

  it('handles new chat button click', () => {
    const mockClearChat = jest.fn()
    const mockPush = jest.fn()
    useChatContextMock.mockReturnValue({ clearChat: mockClearChat })
    nextNavigation.useRouter.mockReturnValue({ push: mockPush })

    render(<Navbar />)

    const newChatButton = screen.getByText('Nuova chat').closest('button')!
    fireEvent.click(newChatButton)

    expect(mockClearChat).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('handles keyboard navigation', async () => {
    const mockClearChat = jest.fn()
    const mockPush = jest.fn()
    useChatContextMock.mockReturnValue({ clearChat: mockClearChat })
    nextNavigation.useRouter.mockReturnValue({ push: mockPush })

    render(<Navbar />)

    const newChatButton = screen.getByRole('button', { name: 'Nuova chat' })
    const uploadButton = screen.getByRole('button', { name: 'Carica file' })

    await act(async () => {
      newChatButton.focus()
    })
    await waitFor(() => expect(newChatButton).toHaveFocus())

    await act(async () => {
      fireEvent.keyDown(newChatButton, { key: 'ArrowDown' })
    })
    await waitFor(() => expect(uploadButton).toHaveFocus())

    await act(async () => {
      fireEvent.keyDown(uploadButton, { key: 'ArrowUp' })
    })
    await waitFor(() => expect(newChatButton).toHaveFocus())

    await act(async () => {
      fireEvent.keyDown(newChatButton, { key: 'Enter' })
    })
    expect(mockClearChat).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('shows API health status', () => {
    render(<Navbar />)

    // Check for API status indicator
    expect(screen.getByLabelText('API Online')).toBeInTheDocument()
  })

  it('shows API offline status when there is an error', () => {
    useHealthSWRMock.mockReturnValue({ data: null, error: new Error('API error') })

    render(<Navbar />)

    // Check for API status indicator
    expect(screen.getByLabelText('API Offline')).toBeInTheDocument()
  })
})
