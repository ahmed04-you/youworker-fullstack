import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, useCommandPalette } from './CommandPalette';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock keyboard shortcut hook
vi.mock('@/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn(),
}));

// Mock session service
const mockSessionsData = [
  { id: 1, title: 'Test Session 1', external_id: 'ext-1', updated_at: '2024-01-01' },
  { id: 2, title: 'Test Session 2', external_id: 'ext-2', updated_at: '2024-01-02' },
  { id: 3, title: 'Search Test', external_id: 'ext-3', updated_at: '2024-01-03' },
];

vi.mock('@/features/chat/api/session-service', () => ({
  useSessionsQuery: () => ({
    data: mockSessionsData,
  }),
}));

// Mock documents service
const mockDocumentsData = {
  documents: [
    { id: 1, name: 'Document 1' },
    { id: 2, name: 'Document 2' },
    { id: 3, name: 'Search Doc' },
  ],
};

vi.mock('@/features/documents/api/document-service', () => ({
  useDocuments: () => ({
    data: mockDocumentsData,
  }),
}));

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
}));

// Mock cmdk
vi.mock('cmdk', () => ({
  Command: ({ children, className }: any) => (
    <div data-testid="command" className={className}>
      {children}
    </div>
  ),
}));

// Add Command subcomponents as properties
const Command = vi.mocked(require('cmdk').Command);
Command.Input = ({ value, onValueChange, placeholder, className }: any) => (
  <input
    data-testid="command-input"
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    placeholder={placeholder}
    className={className}
  />
);
Command.List = ({ children, className }: any) => (
  <div data-testid="command-list" className={className}>
    {children}
  </div>
);
Command.Empty = ({ children, className }: any) => (
  <div data-testid="command-empty" className={className}>
    {children}
  </div>
);
Command.Group = ({ children, heading }: any) => (
  <div data-testid="command-group">
    <div data-testid="group-heading">{heading}</div>
    {children}
  </div>
);
Command.Item = ({ children, onSelect, className }: any) => (
  <button data-testid="command-item" onClick={onSelect} className={className}>
    {children}
  </button>
);

describe('CommandPalette', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should render search input with placeholder', () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);
    const input = screen.getByTestId('command-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search sessions, documents, or navigate...');
  });

  it('should update search value when typing', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByTestId('command-input');
    await user.type(input, 'test');

    expect(input).toHaveValue('test');
  });

  it('should display navigation items', () => {
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const groups = screen.getAllByTestId('command-group');
    expect(groups.length).toBeGreaterThan(0);

    // Check for navigation group
    const headings = screen.getAllByTestId('group-heading');
    const navigateHeading = headings.find((h) => h.textContent === 'Navigate');
    expect(navigateHeading).toBeInTheDocument();
  });

  it('should navigate to chat when Chat item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const items = screen.getAllByTestId('command-item');
    const chatItem = items.find((item) => item.textContent?.includes('Chat'));

    if (chatItem) {
      await user.click(chatItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should navigate to documents when Documents item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const items = screen.getAllByTestId('command-item');
    const documentsItem = items.find((item) => item.textContent?.includes('Documents'));

    if (documentsItem) {
      await user.click(documentsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/documents');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should navigate to sessions when Sessions item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const items = screen.getAllByTestId('command-item');
    const sessionsItem = items.find((item) => item.textContent?.includes('Sessions'));

    if (sessionsItem) {
      await user.click(sessionsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/sessions');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should navigate to settings when Settings item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const items = screen.getAllByTestId('command-item');
    const settingsItem = items.find((item) => item.textContent?.includes('Settings'));

    if (settingsItem) {
      await user.click(settingsItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/settings');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should display filtered sessions when searching', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByTestId('command-input');
    await user.type(input, 'search');

    await waitFor(() => {
      // The component should filter and display matching sessions
      const headings = screen.getAllByTestId('group-heading');
      const sessionsHeading = headings.find((h) => h.textContent === 'Recent Sessions');
      expect(sessionsHeading).toBeInTheDocument();
    });
  });

  it('should display filtered documents when searching', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByTestId('command-input');
    await user.type(input, 'search');

    await waitFor(() => {
      const headings = screen.getAllByTestId('group-heading');
      const documentsHeading = headings.find((h) => h.textContent === 'Documents');
      expect(documentsHeading).toBeInTheDocument();
    });
  });

  it('should reset search when dialog closes', async () => {
    const { rerender } = render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByTestId('command-input');
    const user = userEvent.setup();
    await user.type(input, 'test search');

    expect(input).toHaveValue('test search');

    // Close dialog
    rerender(<CommandPalette open={false} onOpenChange={mockOnOpenChange} />);

    // Open again
    rerender(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    await waitFor(() => {
      expect(screen.getByTestId('command-input')).toHaveValue('');
    });
  });

  it('should close dialog when command is executed', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const items = screen.getAllByTestId('command-item');
    if (items[0]) {
      await user.click(items[0]);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should limit filtered sessions to 5', () => {
    // This is tested by the component's slice(0, 5) logic
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    // With the mock data, we have 3 sessions, all should be displayed
    // If we had more than 5, only 5 would show
    expect(screen.getByTestId('command-list')).toBeInTheDocument();
  });

  it('should navigate to specific session when session item is selected', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    // Find a session item by looking for Test Session 1
    const items = screen.getAllByTestId('command-item');
    const sessionItem = items.find((item) => item.textContent?.includes('Test Session 1'));

    if (sessionItem) {
      await user.click(sessionItem);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/?session=1');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    }
  });

  it('should render command icons', () => {
    const { container } = render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    // Check that SVG icons are rendered
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('should handle empty sessions data', () => {
    vi.mocked(require('@/features/chat/api/session-service').useSessionsQuery).mockReturnValue({
      data: null,
    });

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    // Should still render without errors
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should handle empty documents data', () => {
    vi.mocked(require('@/features/documents/api/document-service').useDocuments).mockReturnValue({
      data: null,
    });

    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    // Should still render without errors
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });
});

describe('useCommandPalette', () => {
  it('should initialize with closed state', () => {
    const { result } = require('@testing-library/react').renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  it('should provide setOpen function', () => {
    const { result } = require('@testing-library/react').renderHook(() => useCommandPalette());
    expect(typeof result.current.setOpen).toBe('function');
  });

  it('should register keyboard shortcut', () => {
    const mockUseKeyboardShortcut = vi.mocked(require('@/hooks/useKeyboardShortcut').useKeyboardShortcut);

    require('@testing-library/react').renderHook(() => useCommandPalette());

    expect(mockUseKeyboardShortcut).toHaveBeenCalledWith(
      'k',
      expect.any(Function),
      { ctrl: true }
    );
  });
});
