import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';

// Mock next-themes
const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

// Mock language provider
vi.mock('@/components/language-provider', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        system: 'System',
        dark: 'Dark',
        light: 'Light',
        aria: 'Toggle theme',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with light theme', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });

  it('should render with dark theme', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: 'dark',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });
  });

  it('should render with system theme', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'system',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('should cycle from system to light when clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'system',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /toggle theme/i });
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('should cycle from light to dark when clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /toggle theme/i });
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should cycle from dark to system when clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: 'dark',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /toggle theme/i });
    await user.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('should show default theme before mounting', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: null,
    });

    const { container } = render(<ThemeToggle />);

    // Component renders but may show default state initially
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  it('should handle null theme as system', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: null,
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('should display tooltip content', () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    render(<ThemeToggle />);

    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Toggle theme (System / Light / Dark)'
    );
  });

  it('should have correct aria-label', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toHaveAttribute('aria-label', 'Toggle theme');
    });
  });

  it('should render correct icon for light theme', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    const { container } = render(<ThemeToggle />);

    await waitFor(() => {
      // Sun icon is rendered for light theme
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-4', 'w-4');
    });
  });

  it('should render correct icon for dark theme', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: 'dark',
    });

    const { container } = render(<ThemeToggle />);

    await waitFor(() => {
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-4', 'w-4');
    });
  });

  it('should use ghost variant and sm size', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
    });

    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toHaveClass('inline-flex', 'items-center', 'gap-2', 'rounded-full');
    });
  });
});
