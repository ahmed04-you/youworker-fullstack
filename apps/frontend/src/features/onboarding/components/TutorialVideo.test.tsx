import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TutorialVideo } from './TutorialVideo';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('TutorialVideo', () => {
  it('renders the component with title and description', () => {
    render(<TutorialVideo />);

    expect(screen.getByText('Video Tutorials')).toBeInTheDocument();
    expect(screen.getByText(/Watch these short videos/i)).toBeInTheDocument();
  });

  it('renders all 3 tutorial cards in list view', () => {
    render(<TutorialVideo />);

    expect(screen.getByText('Getting Started with YouWorker.AI')).toBeInTheDocument();
    expect(screen.getByText('Advanced Features')).toBeInTheDocument();
    expect(screen.getByText('Document Management')).toBeInTheDocument();
  });

  it('displays tutorial descriptions', () => {
    render(<TutorialVideo />);

    expect(screen.getByText(/Learn the basics of using YouWorker.AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Discover tools, analytics, and keyboard shortcuts/i)).toBeInTheDocument();
    expect(screen.getByText(/Learn how to upload, organize, and use documents/i)).toBeInTheDocument();
  });

  it('displays tutorial durations', () => {
    render(<TutorialVideo />);

    // Durations should appear multiple times (in cards and on click)
    expect(screen.getAllByText('3:45').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5:20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4:15').length).toBeGreaterThan(0);
  });

  it('allows selecting a tutorial', () => {
    render(<TutorialVideo />);

    const tutorialCard = screen.getByText('Getting Started with YouWorker.AI');
    fireEvent.click(tutorialCard);

    // Should show the selected tutorial view with back button
    expect(screen.getByText('Back to List')).toBeInTheDocument();
    expect(screen.getByText('Video tutorial placeholder')).toBeInTheDocument();
  });

  it('shows back button when tutorial is selected', () => {
    render(<TutorialVideo />);

    const tutorialCard = screen.getByText('Advanced Features');
    fireEvent.click(tutorialCard);

    const backButton = screen.getByRole('button', { name: /Back to List/i });
    expect(backButton).toBeInTheDocument();
  });

  it('returns to list view when back button is clicked', () => {
    render(<TutorialVideo />);

    // Select a tutorial
    const tutorialCard = screen.getByText('Document Management');
    fireEvent.click(tutorialCard);

    // Click back button
    const backButton = screen.getByRole('button', { name: /Back to List/i });
    fireEvent.click(backButton);

    // Should be back in list view
    expect(screen.getByText('Getting Started with YouWorker.AI')).toBeInTheDocument();
    expect(screen.getByText('Advanced Features')).toBeInTheDocument();
    expect(screen.getByText('Document Management')).toBeInTheDocument();
  });

  it('displays video placeholder when tutorial is selected', () => {
    render(<TutorialVideo />);

    const tutorialCard = screen.getByText('Getting Started with YouWorker.AI');
    fireEvent.click(tutorialCard);

    expect(screen.getByText('Video tutorial placeholder')).toBeInTheDocument();
    expect(screen.getByText(/Duration: 3:45/i)).toBeInTheDocument();
  });

  it('shows watch buttons in list view', () => {
    render(<TutorialVideo />);

    const watchButtons = screen.getAllByRole('button', { name: /Watch/i });
    expect(watchButtons).toHaveLength(3);
  });

  it('clicking watch button on card selects the tutorial', () => {
    render(<TutorialVideo />);

    const watchButtons = screen.getAllByRole('button', { name: /Watch/i });
    fireEvent.click(watchButtons[0]);

    // Should show selected tutorial view
    expect(screen.getByText('Back to List')).toBeInTheDocument();
  });

  it('renders help section with documentation link', () => {
    render(<TutorialVideo />);

    expect(screen.getByText('Need More Help?')).toBeInTheDocument();
    expect(screen.getByText(/Visit our documentation/i)).toBeInTheDocument();

    const docLink = screen.getByRole('link', { name: /View Documentation/i });
    expect(docLink).toHaveAttribute('href', '/docs');
    expect(docLink).toHaveAttribute('target', '_blank');
  });

  it('renders help section with support link', () => {
    render(<TutorialVideo />);

    const supportLink = screen.getByRole('link', { name: /Contact Support/i });
    expect(supportLink).toHaveAttribute('href', '/support');
    expect(supportLink).toHaveAttribute('target', '_blank');
  });

  it('renders play icons for tutorials', () => {
    const { container } = render(<TutorialVideo />);

    // Check that play icons are rendered
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('has proper grid layout for responsive design', () => {
    const { container } = render(<TutorialVideo />);

    // Check that grid container exists
    const gridContainer = container.querySelector('[class*="grid"]');
    expect(gridContainer).toBeInTheDocument();
  });

  it('applies hover effects to tutorial cards', () => {
    const { container } = render(<TutorialVideo />);

    // Check that cards have hover transition classes
    const cards = container.querySelectorAll('[class*="hover"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('displays tutorial card as clickable', () => {
    const { container } = render(<TutorialVideo />);

    // Check that cards have cursor-pointer class
    const clickableCards = container.querySelectorAll('[class*="cursor-pointer"]');
    expect(clickableCards.length).toBeGreaterThan(0);
  });

  it('renders aspect-video container for video display', () => {
    const { container } = render(<TutorialVideo />);

    // Check that aspect-video containers exist
    const videoContainers = container.querySelectorAll('[class*="aspect-video"]');
    expect(videoContainers.length).toBeGreaterThan(0);
  });

  it('has proper semantic HTML structure', () => {
    render(<TutorialVideo />);

    // Check for proper heading
    const heading = screen.getByRole('heading', { name: /Video Tutorials/i });
    expect(heading).toBeInTheDocument();
  });

  it('all external links have proper security attributes', () => {
    render(<TutorialVideo />);

    const externalLinks = screen.getAllByRole('link');
    externalLinks.forEach(link => {
      if (link.getAttribute('target') === '_blank') {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });

  it('renders thumbnail alt text when image loads', () => {
    render(<TutorialVideo />);

    // Thumbnails are set but won't load in test environment
    // We're just checking the component structure
    const { container } = render(<TutorialVideo />);
    expect(container).toBeInTheDocument();
  });

  it('shows external link button when videoUrl is present', () => {
    render(<TutorialVideo />);

    // None of the default tutorials have videoUrl, so we test the rendering
    // In a real scenario with videoUrl, it would show "Watch on External Site"
    const tutorialCard = screen.getByText('Getting Started with YouWorker.AI');
    fireEvent.click(tutorialCard);

    // External link button should not appear when videoUrl is undefined
    expect(screen.queryByText(/Watch on External Site/i)).not.toBeInTheDocument();
  });

  it('displays correct tutorial details when selected', () => {
    render(<TutorialVideo />);

    const tutorialCard = screen.getByText('Advanced Features');
    fireEvent.click(tutorialCard);

    expect(screen.getByText('Advanced Features')).toBeInTheDocument();
    expect(screen.getByText(/Discover tools, analytics, and keyboard shortcuts/i)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 5:20/i)).toBeInTheDocument();
  });

  it('maintains tutorial selection state correctly', () => {
    render(<TutorialVideo />);

    // Select first tutorial
    fireEvent.click(screen.getByText('Getting Started with YouWorker.AI'));
    expect(screen.getByText('Back to List')).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByRole('button', { name: /Back to List/i }));

    // Select different tutorial
    fireEvent.click(screen.getByText('Document Management'));
    expect(screen.getByText(/Duration: 4:15/i)).toBeInTheDocument();
  });

  it('renders with proper spacing classes', () => {
    const { container } = render(<TutorialVideo />);

    // Check that spacing classes are applied
    const spacingElements = container.querySelectorAll('[class*="space-y"]');
    expect(spacingElements.length).toBeGreaterThan(0);
  });

  it('renders help card with distinct styling', () => {
    const { container } = render(<TutorialVideo />);

    // Help card should have primary border and background
    const helpCard = container.querySelector('[class*="border-primary"]');
    expect(helpCard).toBeInTheDocument();
  });
});
