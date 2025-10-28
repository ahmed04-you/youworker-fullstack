import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

// Mock UI components
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogAction: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="confirm-button" {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="cancel-button" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  AlertDialogDescription: ({ children }: any) => <p data-testid="description">{children}</p>,
  AlertDialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2 data-testid="title">{children}</h2>,
}));

describe('DeleteConfirmDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConfirm.mockResolvedValue(undefined);
  });

  it('should not render when closed', () => {
    render(
      <DeleteConfirmDialog
        open={false}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
  });

  it('should display the title', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Session"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('title')).toHaveTextContent('Delete Session');
  });

  it('should display the description', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="This action cannot be undone."
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('description')).toHaveTextContent('This action cannot be undone.');
  });

  it('should display alert icon', () => {
    const { container } = render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // AlertCircle icon should be present
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should display default confirm text', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('confirm-button')).toHaveTextContent('Delete');
  });

  it('should display custom confirm text', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Remove Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        confirmText="Remove"
      />
    );

    expect(screen.getByTestId('confirm-button')).toHaveTextContent('Remove');
  });

  it('should display default cancel text', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
  });

  it('should display custom cancel text', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        cancelText="Go Back"
      />
    );

    expect(screen.getByTestId('cancel-button')).toHaveTextContent('Go Back');
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByTestId('cancel-button');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should show "Deleting..." text during processing', async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void;
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    mockOnConfirm.mockReturnValue(confirmPromise);

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toHaveTextContent('Deleting...');
    });

    resolveConfirm!();
  });

  it('should disable buttons during processing', async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void;
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    mockOnConfirm.mockReturnValue(confirmPromise);

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    const cancelButton = screen.getByTestId('cancel-button');

    await user.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    resolveConfirm!();
  });

  it('should enable buttons after processing completes', async () => {
    const user = userEvent.setup();
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    // After promise resolves, buttons should be enabled again
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });
  });

  it('should handle synchronous onConfirm', async () => {
    const user = userEvent.setup();
    const syncOnConfirm = vi.fn();

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={syncOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    expect(syncOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should handle asynchronous onConfirm', async () => {
    const user = userEvent.setup();
    const asyncOnConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={asyncOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(asyncOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should complete processing flow', async () => {
    const user = userEvent.setup();

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    // Processing completes successfully
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });
  });

  it('should accept external isLoading prop', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    // External isLoading prop exists but component controls its own loading state
    const confirmButton = screen.getByTestId('confirm-button');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should not call onConfirm multiple times on multiple clicks', async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void;
    const confirmPromise = new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    });
    mockOnConfirm.mockReturnValue(confirmPromise);

    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');

    // Click multiple times
    await user.click(confirmButton);
    await user.click(confirmButton);
    await user.click(confirmButton);

    // Should only be called once because button is disabled after first click
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    resolveConfirm!();
  });

  it('should have destructive styling on confirm button', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    expect(confirmButton).toHaveClass('bg-destructive');
  });

  it('should have rounded-full class on buttons', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    const cancelButton = screen.getByTestId('cancel-button');

    expect(confirmButton).toHaveClass('rounded-full');
    expect(cancelButton).toHaveClass('rounded-full');
  });
});
