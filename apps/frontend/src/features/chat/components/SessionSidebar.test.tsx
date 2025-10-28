import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { SessionSidebar } from './SessionSidebar';
import type { SessionSummary } from '@/lib/types';

describe('SessionSidebar', () => {
  const mockSessions: SessionSummary[] = [
    {
      id: 1,
      title: 'Test Session 1',
      model: 'gpt-oss:20b',
      enable_tools: true,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Test Session 2',
      model: 'claude:3',
      enable_tools: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  const defaultProps = {
    sessions: mockSessions,
    sessionsLoading: false,
    activeSession: mockSessions[0],
    onRefresh: vi.fn(),
    onNewSession: vi.fn(),
    onSelectSession: vi.fn(),
    onRenameSession: vi.fn(),
    onDeleteSession: vi.fn(),
    deriveSessionName: (session: SessionSummary | null) =>
      session?.title || 'Untitled Session',
  };

  it('should render the sidebar with heading', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText(/conversations/i)).toBeInTheDocument();
  });

  it('should render new conversation button', () => {
    render(<SessionSidebar {...defaultProps} />);

    const newButton = screen.getByTestId('new-session');
    expect(newButton).toBeInTheDocument();
    expect(newButton).toHaveTextContent(/new conversation/i);
  });

  it('should call onNewSession when new button is clicked', () => {
    render(<SessionSidebar {...defaultProps} />);

    const newButton = screen.getByTestId('new-session');
    fireEvent.click(newButton);

    expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1);
  });

  it('should render refresh button', () => {
    render(<SessionSidebar {...defaultProps} />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('should call onRefresh when refresh button is clicked', () => {
    render(<SessionSidebar {...defaultProps} />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should render all sessions', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    expect(screen.getByText('Test Session 2')).toBeInTheDocument();
  });

  it('should highlight active session', () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessions = screen.getAllByRole('button').filter((btn) =>
      btn.textContent?.includes('Test Session')
    );

    // Active session should have specific styling
    const activeSession = sessions[0];
    expect(activeSession.className).toContain('border-primary');
  });

  it('should call onSelectSession when session is clicked', () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionButton = screen.getByText('Test Session 2').closest('button');
    expect(sessionButton).toBeInTheDocument();

    if (sessionButton) {
      fireEvent.click(sessionButton);
      expect(defaultProps.onSelectSession).toHaveBeenCalledWith(mockSessions[1]);
    }
  });

  it('should show loading skeletons when loading', () => {
    render(<SessionSidebar {...defaultProps} sessionsLoading={true} />);

    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no sessions', () => {
    render(<SessionSidebar {...defaultProps} sessions={[]} />);

    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('should display session metadata', () => {
    render(<SessionSidebar {...defaultProps} />);

    // Should show model badge
    expect(screen.getByText(/gpt/i)).toBeInTheDocument();

    // Should show tools indicator
    expect(screen.getByText(/tools/i)).toBeInTheDocument();
  });

  it('should show tools vs chat indicator correctly', () => {
    render(<SessionSidebar {...defaultProps} />);

    // First session has tools enabled
    const toolsIndicators = screen.getAllByText(/tools/i);
    expect(toolsIndicators.length).toBeGreaterThan(0);

    // Second session has tools disabled (should show "Chat")
    const chatIndicators = screen.getAllByText(/chat/i);
    expect(chatIndicators.length).toBeGreaterThan(0);
  });

  it('should open rename dialog when rename button is clicked', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    fireEvent.click(renameButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/rename conversation/i)).toBeInTheDocument();
    });
  });

  it('should open delete dialog when delete button is clicked', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/delete this session/i)).toBeInTheDocument();
    });
  });

  it('should handle rename submission', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // Open rename dialog
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    fireEvent.click(renameButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/rename conversation/i)).toBeInTheDocument();
    });

    // Type new name
    const input = screen.getByPlaceholderText(/team sync/i);
    fireEvent.change(input, { target: { value: 'New Session Name' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onRenameSession).toHaveBeenCalledWith(
        mockSessions[0],
        'New Session Name'
      );
    });
  });

  it('should handle delete confirmation', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // Open delete dialog
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/delete this session/i)).toBeInTheDocument();
    });

    // Confirm delete
    const confirmButton = screen.getAllByRole('button', { name: /delete/i }).find(
      (btn) => btn.textContent === 'Delete'
    );
    expect(confirmButton).toBeInTheDocument();

    if (confirmButton) {
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(defaultProps.onDeleteSession).toHaveBeenCalledWith(mockSessions[0]);
      });
    }
  });

  it('should cancel rename dialog', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // Open rename dialog
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    fireEvent.click(renameButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/rename conversation/i)).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/rename conversation/i)).not.toBeInTheDocument();
    });

    // Should not call onRenameSession
    expect(defaultProps.onRenameSession).not.toHaveBeenCalled();
  });

  it('should cancel delete dialog', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // Open delete dialog
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/delete this session/i)).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/delete this session/i)).not.toBeInTheDocument();
    });

    // Should not call onDeleteSession
    expect(defaultProps.onDeleteSession).not.toHaveBeenCalled();
  });

  it('should show Knowledge Hub section', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText(/knowledge hub/i)).toBeInTheDocument();
  });

  it('should have link to documents page', () => {
    render(<SessionSidebar {...defaultProps} />);

    const link = screen.getByRole('link', { name: /visit documents/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/documents');
  });

  it('should disable save button when rename input is empty', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // Open rename dialog
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    fireEvent.click(renameButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/rename conversation/i)).toBeInTheDocument();
    });

    // Clear input
    const input = screen.getByPlaceholderText(/team sync/i);
    fireEvent.change(input, { target: { value: '' } });

    // Save button should be disabled
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('should show loading spinner when sessions are loading', () => {
    render(<SessionSidebar {...defaultProps} sessionsLoading={true} />);

    // Refresh button should show loading spinner
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    const spinner = refreshButton.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
