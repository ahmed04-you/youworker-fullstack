import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenameSessionDialog } from './RenameSessionDialog';
import { SessionSummary } from '@/lib/types';

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, disabled, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

describe('RenameSessionDialog', () => {
  const mockSession: SessionSummary = {
    id: 1,
    title: 'Test Session',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    message_count: 5,
  };

  const mockOnOpenChange = vi.fn();
  const mockOnRename = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRename.mockResolvedValue(undefined);
  });

  it('should not render when closed', () => {
    render(
      <RenameSessionDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should display dialog title', () => {
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    expect(screen.getByRole('heading', { name: 'Rename Conversation' })).toBeInTheDocument();
  });

  it('should display dialog description', () => {
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    expect(
      screen.getByText('Give this conversation a meaningful name to find it easily later.')
    ).toBeInTheDocument();
  });

  it('should populate input with session title', () => {
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    expect(input).toHaveValue('Test Session');
  });

  it('should allow typing in the input', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);
    await user.type(input, 'New Title');

    expect(input).toHaveValue('New Title');
  });

  it('should call onRename when form is submitted', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);
    await user.type(input, 'Updated Title');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnRename).toHaveBeenCalledWith(1, 'Updated Title');
    });
  });

  it('should close dialog after successful rename', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);
    await user.type(input, 'Updated Title');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should disable save button when title is empty', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('should disable save button when title is only whitespace', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);
    await user.type(input, '   ');

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('should show loading state during rename', async () => {
    const user = userEvent.setup();
    let resolveRename: () => void;
    const renamePromise = new Promise<void>((resolve) => {
      resolveRename = resolve;
    });
    mockOnRename.mockReturnValue(renamePromise);

    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should show loading spinner
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    // Resolve the promise
    resolveRename!();
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should disable inputs during loading', async () => {
    const user = userEvent.setup();
    let resolveRename: () => void;
    const renamePromise = new Promise<void>((resolve) => {
      resolveRename = resolve;
    });
    mockOnRename.mockReturnValue(renamePromise);

    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should disable input and buttons
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter a title...')).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    resolveRename!();
  });

  it('should call onOpenChange when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should not call onRename when session is null', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={null}
        onRename={mockOnRename}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(mockOnRename).not.toHaveBeenCalled();
  });

  it('should trim whitespace from title when submitting', async () => {
    const user = userEvent.setup();
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    await user.clear(input);
    await user.type(input, '  Trimmed Title  ');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnRename).toHaveBeenCalledWith(1, 'Trimmed Title');
    });
  });

  it('should handle rename error gracefully', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOnRename.mockRejectedValue(new Error('Rename failed'));

    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // Dialog should still be open after error
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);

    consoleErrorSpy.mockRestore();
  });

  it('should reset title when dialog reopens', () => {
    const { rerender } = render(
      <RenameSessionDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    // Open dialog
    rerender(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    expect(input).toHaveValue('Test Session');
  });

  it('should render input with proper attributes', () => {
    render(
      <RenameSessionDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        session={mockSession}
        onRename={mockOnRename}
      />
    );

    const input = screen.getByPlaceholderText('Enter a title...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'title');
  });
});
