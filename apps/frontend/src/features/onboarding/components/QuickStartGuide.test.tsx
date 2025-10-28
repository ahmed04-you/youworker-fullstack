import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuickStartGuide } from './QuickStartGuide';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('QuickStartGuide', () => {
  it('renders the component with title and description', () => {
    render(<QuickStartGuide />);

    expect(screen.getByText('Quick Start Guide')).toBeInTheDocument();
    expect(screen.getByText(/Get started with YouWorker.AI/i)).toBeInTheDocument();
  });

  it('renders all 8 quick start items', () => {
    render(<QuickStartGuide />);

    // Check that all items are rendered
    expect(screen.getByText('Start a Conversation')).toBeInTheDocument();
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
    expect(screen.getByText('Enable Tools')).toBeInTheDocument();
    expect(screen.getByText('Track Your Usage')).toBeInTheDocument();
    expect(screen.getByText('Learn Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Command Palette')).toBeInTheDocument();
    expect(screen.getByText('Manage Documents')).toBeInTheDocument();
    expect(screen.getByText('Customize Settings')).toBeInTheDocument();
  });

  it('renders item descriptions correctly', () => {
    render(<QuickStartGuide />);

    expect(screen.getByText(/Begin chatting with the AI assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload PDFs, text files, images, and audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Activate tools like web search/i)).toBeInTheDocument();
    expect(screen.getByText(/Monitor your conversation history/i)).toBeInTheDocument();
  });

  it('renders action buttons with correct links', () => {
    render(<QuickStartGuide />);

    // Items with actions
    const goToChat = screen.getByRole('link', { name: /Go to Chat/i });
    expect(goToChat).toHaveAttribute('href', '/');

    const uploadFiles = screen.getByRole('link', { name: /Upload Files/i });
    expect(uploadFiles).toHaveAttribute('href', '/documents');

    const viewAnalytics = screen.getByRole('link', { name: /View Analytics/i });
    expect(viewAnalytics).toHaveAttribute('href', '/analytics');

    const viewDocuments = screen.getByRole('link', { name: /View Documents/i });
    expect(viewDocuments).toHaveAttribute('href', '/documents');

    const openSettings = screen.getByRole('link', { name: /Open Settings/i });
    expect(openSettings).toHaveAttribute('href', '/settings');
  });

  it('does not render action buttons for items without actions', () => {
    render(<QuickStartGuide />);

    // Enable Tools and Learn Keyboard Shortcuts don't have action buttons
    // We should only have 5 action buttons total
    const actionButtons = screen.getAllByRole('link');
    expect(actionButtons).toHaveLength(5);
  });

  it('renders the Pro Tip card', () => {
    render(<QuickStartGuide />);

    expect(screen.getByText('Pro Tip')).toBeInTheDocument();
    expect(screen.getByText(/Use the Command Palette \(Cmd\+K\)/i)).toBeInTheDocument();
  });

  it('renders cards with proper structure', () => {
    const { container } = render(<QuickStartGuide />);

    // Check that cards are rendered (should be 8 quick start items + 1 pro tip = 9 cards total)
    const cards = container.querySelectorAll('[class*="Card"]');
    expect(cards.length).toBeGreaterThanOrEqual(8);
  });

  it('renders icons for all items', () => {
    const { container } = render(<QuickStartGuide />);

    // Check that SVG icons are rendered
    const icons = container.querySelectorAll('svg');
    // Should have at least 8 icons for the items + 1 for pro tip
    expect(icons.length).toBeGreaterThanOrEqual(9);
  });

  it('uses grid layout for responsive design', () => {
    const { container } = render(<QuickStartGuide />);

    // Check that the grid container exists with proper classes
    const gridContainer = container.querySelector('[class*="grid"]');
    expect(gridContainer).toBeInTheDocument();
  });

  it('applies hover effects to cards', () => {
    const { container } = render(<QuickStartGuide />);

    // Check that cards have hover transition classes
    const cards = container.querySelectorAll('[class*="hover"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders with proper spacing classes', () => {
    const { container } = render(<QuickStartGuide />);

    // Check that spacing classes are applied
    const spacingElements = container.querySelectorAll('[class*="space-y"]');
    expect(spacingElements.length).toBeGreaterThan(0);
  });

  it('has descriptive card titles', () => {
    render(<QuickStartGuide />);

    const titles = [
      'Start a Conversation',
      'Upload Documents',
      'Enable Tools',
      'Track Your Usage',
      'Learn Keyboard Shortcuts',
      'Command Palette',
      'Manage Documents',
      'Customize Settings',
    ];

    titles.forEach(title => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('mentions keyboard shortcut Cmd+U for uploads', () => {
    render(<QuickStartGuide />);

    expect(screen.getByText(/Press Cmd\+U anywhere/i)).toBeInTheDocument();
  });

  it('mentions keyboard shortcut Cmd+K in pro tip', () => {
    render(<QuickStartGuide />);

    expect(screen.getByText(/Cmd\+K/i)).toBeInTheDocument();
  });

  it('has proper semantic HTML structure', () => {
    render(<QuickStartGuide />);

    // Check for proper heading
    const heading = screen.getByRole('heading', { name: /Quick Start Guide/i });
    expect(heading).toBeInTheDocument();
  });

  it('all action links are properly accessible', () => {
    render(<QuickStartGuide />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.textContent).toBeTruthy();
    });
  });
});
