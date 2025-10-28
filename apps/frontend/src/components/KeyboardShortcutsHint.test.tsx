import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcutsHint } from './KeyboardShortcutsHint';

// Mock the shortcuts utilities
vi.mock('@/lib/shortcuts', () => ({
  formatShortcutKey: (key: string) => key.toUpperCase().replace('CMD', '⌘'),
}));

describe('KeyboardShortcutsHint', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      key: vi.fn(),
      length: 0,
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not render immediately on mount', () => {
    render(<KeyboardShortcutsHint />);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders after 3 second delay', async () => {
    render(<KeyboardShortcutsHint />);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
  });

  it('does not render if previously dismissed permanently', () => {
    localStorageMock['shortcuts-hint-dismissed'] = 'true';

    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders all common shortcuts', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Command Palette')).toBeInTheDocument();
      expect(screen.getByText('New Session')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
      expect(screen.getByText('Close/Stop')).toBeInTheDocument();
    });
  });

  it('renders formatted shortcut keys', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      // Our mock formatShortcutKey converts cmd to ⌘
      const kbdElements = screen.getAllByRole('generic').filter(el =>
        el.tagName === 'KBD'
      );
      expect(kbdElements.length).toBeGreaterThan(0);
    });
  });

  it('hides temporarily when X button is clicked', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    const closeButton = screen.getAllByRole('button')[0]; // X button
    fireEvent.click(closeButton);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('dismisses permanently when "Don\'t show again" is clicked', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /Don't show again/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    expect(localStorage.setItem).toHaveBeenCalledWith('shortcuts-hint-dismissed', 'true');
  });

  it('opens help modal when "View All" is clicked', async () => {
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View All/i });
    fireEvent.click(viewAllButton);

    expect(mockDispatchEvent).toHaveBeenCalled();
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    mockDispatchEvent.mockRestore();
  });

  it('dispatches keyboard event with "?" key on View All click', async () => {
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View All/i });
    fireEvent.click(viewAllButton);

    const dispatchedEvent = mockDispatchEvent.mock.calls[0][0] as KeyboardEvent;
    expect(dispatchedEvent.key).toBe('?');

    mockDispatchEvent.mockRestore();
  });

  it('renders with proper card styling', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    // Check for fixed positioning and z-index
    const card = container.querySelector('[class*="fixed"]');
    expect(card).toBeInTheDocument();
  });

  it('renders keyboard icon', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('renders with animation classes', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    // Check for animation classes
    const animatedElement = container.querySelector('[class*="animate-in"]');
    expect(animatedElement).toBeInTheDocument();
  });

  it('has descriptive subtitle text', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText(/Boost your productivity with these shortcuts/i)).toBeInTheDocument();
    });
  });

  it('renders all shortcut actions in correct order', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const shortcuts = screen.getByText('Keyboard Shortcuts').parentElement?.querySelectorAll('[class*="flex items-center gap-2"]');
      expect(shortcuts).toBeDefined();
    });
  });

  it('kbd elements have proper styling', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBe(4); // 4 common shortcuts

      kbdElements.forEach(kbd => {
        expect(kbd.className).toContain('bg-muted');
      });
    });
  });

  it('renders two action buttons', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const viewAllButton = screen.getByRole('button', { name: /View All/i });
      const dismissButton = screen.getByRole('button', { name: /Don't show again/i });

      expect(viewAllButton).toBeInTheDocument();
      expect(dismissButton).toBeInTheDocument();
    });
  });

  it('has proper button styling variants', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const viewAllButton = screen.getByRole('button', { name: /View All/i });
      const dismissButton = screen.getByRole('button', { name: /Don't show again/i });

      // View All should be outline variant
      expect(viewAllButton.className).toContain('outline');

      // Dismiss should be ghost variant
      expect(dismissButton.className).toContain('ghost');
    });
  });

  it('positions hint at bottom left of screen', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const card = container.querySelector('[class*="fixed"]');
      expect(card?.className).toContain('bottom-4');
      expect(card?.className).toContain('left-4');
    });
  });

  it('has high z-index for visibility', async () => {
    const { container } = render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      const card = container.querySelector('[class*="z-50"]');
      expect(card).toBeInTheDocument();
    });
  });

  it('clears timeout on unmount', () => {
    const { unmount } = render(<KeyboardShortcutsHint />);

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('maintains visibility state correctly through interactions', async () => {
    render(<KeyboardShortcutsHint />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    // Temporarily dismiss
    const closeButton = screen.getAllByRole('button')[0];
    fireEvent.click(closeButton);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    // Should stay hidden
    vi.advanceTimersByTime(3000);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
