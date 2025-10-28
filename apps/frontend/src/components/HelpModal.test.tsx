import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpModal } from './HelpModal';

// Mock the settings context
vi.mock('@/lib/settings-context', () => ({
  useSettings: () => ({
    settings: {
      theme: 'light',
      shortcuts: {
        'cmd+n': 'New session',
        'cmd+enter': 'Send message',
      },
    },
    updateSetting: vi.fn(),
    resetSettings: vi.fn(),
    isConnected: true,
  }),
}));

// Mock the shortcuts utilities
vi.mock('@/lib/shortcuts', () => ({
  getShortcutsByCategory: () => [
    {
      category: 'Navigation',
      shortcuts: [
        {
          key: 'cmd+n',
          action: 'New Session',
          description: 'Create a new chat session',
        },
        {
          key: 'cmd+k',
          action: 'Command Palette',
          description: 'Open the command palette',
        },
      ],
    },
    {
      category: 'Chat',
      shortcuts: [
        {
          key: 'cmd+enter',
          action: 'Send Message',
          description: 'Send the current message',
        },
        {
          key: 'esc',
          action: 'Stop',
          description: 'Stop the current response',
        },
      ],
    },
  ],
  formatShortcutKey: (key: string) => key.toUpperCase().replace('CMD', '⌘'),
}));

describe('HelpModal', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    mockOnOpenChange.mockClear();
  });

  it('renders when open prop is true', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Help & FAQ')).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    render(<HelpModal open={false} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText('Help & FAQ')).not.toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('renders all FAQ items by default', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText(/How do I start a new chat session\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How do I use voice input\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What are AI tools\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How do I upload documents\?/i)).toBeInTheDocument();
  });

  it('filters FAQ items based on search term', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'voice' } });

    expect(screen.getByText(/How do I use voice input\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/How do I upload documents\?/i)).not.toBeInTheDocument();
  });

  it('filters shortcuts based on search term', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'send' } });

    expect(screen.getByText('Send Message')).toBeInTheDocument();
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });

  it('shows empty state when no FAQ results match', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'zzzzzzz' } });

    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
  });

  it('shows empty state when no shortcuts match', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'zzzzzzz' } });

    expect(screen.getByText(/No shortcuts match your search/i)).toBeInTheDocument();
  });

  it('clears search term when X button is clicked', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'voice' } });

    expect(searchInput.value).toBe('voice');

    const clearButton = screen.getByRole('button', { name: '' });
    fireEvent.click(clearButton);

    expect(searchInput.value).toBe('');
  });

  it('does not show clear button when search is empty', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i) as HTMLInputElement;
    expect(searchInput.value).toBe('');

    // The clear button (X) should not be visible
    const buttons = screen.getAllByRole('button');
    const clearButton = buttons.find(btn => btn.querySelector('[class*="X"]'));
    expect(clearButton).toBeUndefined();
  });

  it('renders keyboard shortcuts section', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('renders shortcuts with formatted keys', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    // Our mock formatShortcutKey converts cmd to ⌘
    expect(screen.getByText('New Session')).toBeInTheDocument();
    expect(screen.getByText('Send Message')).toBeInTheDocument();
    expect(screen.getByText('Command Palette')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('renders shortcut descriptions', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Create a new chat session')).toBeInTheDocument();
    expect(screen.getByText('Open the command palette')).toBeInTheDocument();
    expect(screen.getByText('Send the current message')).toBeInTheDocument();
    expect(screen.getByText('Stop the current response')).toBeInTheDocument();
  });

  it('renders contact support section', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Need More Help?')).toBeInTheDocument();
    expect(screen.getByText(/Can't find what you're looking for\?/i)).toBeInTheDocument();
  });

  it('renders contact support email link', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const contactLink = screen.getByRole('link', { name: /Contact Support/i });
    expect(contactLink).toHaveAttribute('href', 'mailto:support@youworker.ai');
  });

  it('renders documentation link', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const docsLink = screen.getByRole('link', { name: /View Docs/i });
    expect(docsLink).toHaveAttribute('href', '/docs');
    expect(docsLink).toHaveAttribute('target', '_blank');
  });

  it('has two-column layout on larger screens', () => {
    const { container } = render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    // Check that grid container exists
    const gridContainer = container.querySelector('[class*="grid-cols"]');
    expect(gridContainer).toBeInTheDocument();
  });

  it('renders FAQ section title', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('renders search icon', () => {
    const { container } = render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchIcons = container.querySelectorAll('svg');
    expect(searchIcons.length).toBeGreaterThan(0);
  });

  it('renders keyboard shortcut keys as kbd elements', () => {
    const { container } = render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const kbdElements = container.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
  });

  it('shows message about custom shortcuts in settings', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText(/Custom shortcuts can be configured in Settings/i)).toBeInTheDocument();
  });

  it('case-insensitive search works for FAQ', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'VOICE' } });

    expect(screen.getByText(/How do I use voice input\?/i)).toBeInTheDocument();
  });

  it('case-insensitive search works for shortcuts', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'SESSION' } });

    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('search matches partial words', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const searchInput = screen.getByPlaceholderText(/Search help articles/i);
    fireEvent.change(searchInput, { target: { value: 'doc' } });

    expect(screen.getByText(/How do I upload documents\?/i)).toBeInTheDocument();
  });

  it('renders FAQ answers', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText(/Press Cmd\+N or click the \+ button/i)).toBeInTheDocument();
    expect(screen.getByText(/Click the microphone icon/i)).toBeInTheDocument();
  });

  it('all external links have proper security attributes', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const externalLinks = screen.getAllByRole('link');
    externalLinks.forEach(link => {
      if (link.getAttribute('target') === '_blank') {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });

  it('dialog has proper heading structure', () => {
    render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    const mainHeading = screen.getByRole('heading', { name: /Help & FAQ/i });
    expect(mainHeading).toBeInTheDocument();
  });

  it('renders with scrollable content area', () => {
    const { container } = render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    // Check for overflow styles
    const scrollableContent = container.querySelector('[class*="overflow-y-auto"]');
    expect(scrollableContent).toBeInTheDocument();
  });

  it('has max height constraint on dialog', () => {
    const { container } = render(<HelpModal open={true} onOpenChange={mockOnOpenChange} />);

    // Check for max-h class
    const maxHeightElement = container.querySelector('[class*="max-h"]');
    expect(maxHeightElement).toBeInTheDocument();
  });
});
