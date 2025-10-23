import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { ChatTranscript } from '../chat-transcript'

jest.mock('@/lib/i18n', () => {
  const translations: Record<string, string> = {
    'chat.title': 'YouWorker.AI',
    'chat.message.user': 'Messaggio utente',
    'chat.message.assistant': 'Messaggio assistente',
    'chat.status.analyzing': 'Sto analizzando le informazioni per offrirti la risposta migliore…',
    'chat.actions.copy': 'Copia messaggio',
    'chat.actions.regenerate': 'Rigenera risposta',
    'chat.actions.edit': 'Modifica messaggio',
    'chat.actions.more': 'Azioni messaggio',
    'chat.actions.editing': 'Modifica in corso',
    'chat.empty.title': 'Inizia una conversazione',
    'chat.empty.description': 'Fai una domanda o ingerisci un documento per iniziare a lavorare insieme.',
    'chat.placeholder.examples': 'Prova a chiedere un riassunto, una email o un\'analisi.',
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

jest.mock('react-markdown', () => {
  const MockReactMarkdown = (props: any) => <div>{props.children}</div>
  MockReactMarkdown.displayName = 'MockReactMarkdown'
  return MockReactMarkdown
})
jest.mock('remark-gfm', () => jest.fn())
jest.mock('rehype-highlight', () => jest.fn())
jest.mock('rehype-raw', () => jest.fn())

jest.mock('@/lib/contexts/chat-context', () => {
  const actual = jest.requireActual('@/lib/contexts/chat-context')
  return {
    ...actual,
    useChatContext: jest.fn(() => ({
      messages: [],
      streamingText: '',
      isStreaming: false,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })),
  }
})

const useChatContextMock = require('@/lib/contexts/chat-context').useChatContext as jest.Mock

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView; mock it to avoid errors during tests
  Element.prototype.scrollIntoView = jest.fn()
})

beforeEach(() => {
  useChatContextMock.mockReturnValue({
    messages: [],
    streamingText: '',
    isStreaming: false,
    sessionId: 'test-session',
    setMessages: jest.fn(),
    setStreamingText: jest.fn(),
    setIsStreaming: jest.fn(),
    addToolEvent: jest.fn(),
    setMetadata: jest.fn(),
    setAudioPlaying: jest.fn(),
    ensureSession: jest.fn(),
  })
})

describe('ChatTranscript', () => {
  it('renders empty transcript when no messages', () => {
    render(<ChatTranscript />)
    expect(screen.getByRole('log')).toBeInTheDocument()
  })

  it('renders user and assistant messages correctly', () => {
    useChatContextMock.mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Ciao, come stai?',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Ciao! Sto bene, grazie. Come posso aiutarti oggi?',
          createdAt: new Date().toISOString(),
        },
      ],
      streamingText: '',
      isStreaming: false,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })
    render(<ChatTranscript />)
    
    expect(screen.getByText('Ciao, come stai?')).toBeInTheDocument()
    expect(screen.getByText('Ciao! Sto bene, grazie. Come posso aiutarti oggi?')).toBeInTheDocument()
  })

  it('displays streaming text when isStreaming is true', () => {
    useChatContextMock.mockReturnValue({
      messages: [],
      streamingText: 'Sto scrivendo una risposta...',
      isStreaming: true,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })
    render(<ChatTranscript />)
    
    expect(screen.getByText('Sto scrivendo una risposta...')).toBeInTheDocument()
    expect(screen.getByLabelText('Messaggio assistente')).toBeInTheDocument()
  })

  it('applies correct ARIA labels', () => {
    render(<ChatTranscript />)
    
    expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'YouWorker.AI')
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite')
  })

  it('displays messages with correct roles', () => {
    useChatContextMock.mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Messaggio utente',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Messaggio assistente',
          createdAt: new Date().toISOString(),
        },
      ],
      streamingText: '',
      isStreaming: false,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })
    render(<ChatTranscript />)
    
    expect(screen.getByText('Messaggio utente').closest('[role="article"]')).toHaveAttribute(
      'aria-label',
      'Messaggio utente'
    )
    expect(screen.getByText('Messaggio assistente').closest('[role="article"]')).toHaveAttribute(
      'aria-label',
      'Messaggio assistente'
    )
  })

  it('invokes message action callbacks when menu items are selected', async () => {
    const user = userEvent.setup()
    const onCopy = jest.fn()
    const onRegenerate = jest.fn()
    const onEdit = jest.fn()

    useChatContextMock.mockReturnValue({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'Messaggio utente',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Messaggio assistente',
          createdAt: new Date().toISOString(),
        },
      ],
      streamingText: '',
      isStreaming: false,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })

    render(
      <ChatTranscript
        onCopyMessage={onCopy}
        onRegenerateMessage={onRegenerate}
        onEditMessage={onEdit}
      />
    )

    const [userActionsButton, assistantActionsButton] = screen.getAllByRole('button', { name: 'Azioni messaggio' })

    await user.click(userActionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Copia messaggio' }))
    expect(onCopy).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'user-1' }), 0)

    await user.click(userActionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Modifica messaggio' }))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 0)

    await user.click(assistantActionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Copia messaggio' }))
    expect(onCopy).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'assistant-1' }), 1)

    await user.click(assistantActionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Rigenera risposta' }))
    expect(onRegenerate).toHaveBeenCalledWith(expect.objectContaining({ id: 'assistant-1' }), 1)
  })

  it('disables edit action when the message is already being edited', async () => {
    const user = userEvent.setup()
    const onEdit = jest.fn()

    useChatContextMock.mockReturnValue({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'Messaggio utente',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Messaggio assistente',
          createdAt: new Date().toISOString(),
        },
      ],
      streamingText: '',
      isStreaming: false,
      sessionId: 'test-session',
      setMessages: jest.fn(),
      setStreamingText: jest.fn(),
      setIsStreaming: jest.fn(),
      addToolEvent: jest.fn(),
      setMetadata: jest.fn(),
      setAudioPlaying: jest.fn(),
      ensureSession: jest.fn(),
    })

    render(
      <ChatTranscript
        onEditMessage={onEdit}
        editingMessageId="user-1"
      />
    )

    const [userActionsButton] = screen.getAllByRole('button', { name: 'Azioni messaggio' })

    await user.click(userActionsButton)

    const editItem = await screen.findByRole('menuitem', { name: 'Modifica messaggio' })
    expect(editItem).toHaveAttribute('aria-disabled', 'true')
    expect(editItem).toHaveAttribute('data-disabled')
    expect(onEdit).not.toHaveBeenCalled()
  })
})
