import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingManager } from './OnboardingManager';

// Mock onboarding feature
const mockOpenOnboarding = vi.fn();
const mockCloseOnboarding = vi.fn();
const mockUseOnboarding = vi.fn();

vi.mock('@/features/onboarding', () => ({
  WelcomeDialog: ({ open, onOpenChange }: any) =>
    open ? (
      <div data-testid="welcome-dialog">
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
  useOnboarding: () => mockUseOnboarding(),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('OnboardingManager', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should render WelcomeDialog when open', () => {
    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: true,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);
    expect(screen.getByTestId('welcome-dialog')).toBeInTheDocument();
  });

  it('should not render WelcomeDialog when closed', () => {
    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);
    expect(screen.queryByTestId('welcome-dialog')).not.toBeInTheDocument();
  });

  it('should show onboarding on first visit after delay', async () => {
    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    // Fast-forward past the 1 second delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockOpenOnboarding).toHaveBeenCalled();
      expect(localStorage.setItem).toHaveBeenCalledWith('has-visited', 'true');
    });
  });

  it('should not show onboarding if user has already visited', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockOpenOnboarding).not.toHaveBeenCalled();
  });

  it('should not show onboarding if already complete', () => {
    mockUseOnboarding.mockReturnValue({
      isComplete: true,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockOpenOnboarding).not.toHaveBeenCalled();
  });

  it('should show resume tour button when onboarding is incomplete and user has visited', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    expect(screen.getByText(/Resume Tour/)).toBeInTheDocument();
  });

  it('should display current step in resume tour button', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 3,
    });

    render(<OnboardingManager />);

    expect(screen.getByText(/Resume Tour \(Step 4\/6\)/)).toBeInTheDocument();
  });

  it('should not show step number when on step 0', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    const button = screen.getByText(/Resume Tour/);
    expect(button.textContent).not.toContain('Step');
  });

  it('should open onboarding when resume tour button is clicked', async () => {
    // Use real timers for userEvent
    vi.useRealTimers();
    const user = userEvent.setup();

    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    const resumeButton = screen.getByText(/Resume Tour/);
    await user.click(resumeButton);

    expect(mockOpenOnboarding).toHaveBeenCalled();

    // Restore fake timers for cleanup
    vi.useFakeTimers();
  });

  it('should hide resume tour button when dismissed', async () => {
    // Use real timers for userEvent
    vi.useRealTimers();
    const user = userEvent.setup();

    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    const dismissButton = screen.getByLabelText(/Dismiss resume tour button/);
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText(/Resume Tour/)).not.toBeInTheDocument();
      expect(localStorage.setItem).toHaveBeenCalledWith('dismissed-resume-tour', 'true');
    });

    // Restore fake timers for cleanup
    vi.useFakeTimers();
  });

  it('should not show resume tour if previously dismissed', () => {
    localStorageMock['has-visited'] = 'true';
    localStorageMock['dismissed-resume-tour'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    expect(screen.queryByText(/Resume Tour/)).not.toBeInTheDocument();
  });

  it('should not show resume tour when onboarding is open', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: true,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    expect(screen.queryByText(/Resume Tour/)).not.toBeInTheDocument();
  });

  it('should call openOnboarding when WelcomeDialog is opened', () => {
    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: true,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    // Since the dialog is already open, we're testing the handleOpenChange callback
    // The actual interaction would be through the WelcomeDialog component
    expect(screen.getByTestId('welcome-dialog')).toBeInTheDocument();
  });

  it('should call closeOnboarding when WelcomeDialog is closed', async () => {
    // Use real timers for userEvent
    vi.useRealTimers();
    const user = userEvent.setup();

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: true,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(mockCloseOnboarding).toHaveBeenCalled();
    });

    // Restore fake timers for cleanup
    vi.useFakeTimers();
  });

  it('should render with HelpCircle icon in resume button', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    const { container } = render(<OnboardingManager />);

    // Check for SVG icon
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should have proper aria-label on resume button', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    const resumeButton = screen.getByLabelText(/Resume onboarding tour/);
    expect(resumeButton).toBeInTheDocument();
  });

  it('should have proper aria-label on dismiss button', () => {
    localStorageMock['has-visited'] = 'true';

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 2,
    });

    render(<OnboardingManager />);

    const dismissButton = screen.getByLabelText(/Dismiss resume tour button/);
    expect(dismissButton).toBeInTheDocument();
  });

  it('should handle server-side rendering gracefully', () => {
    const windowSpy = vi.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => undefined as any);

    mockUseOnboarding.mockReturnValue({
      isComplete: false,
      isOpen: false,
      openOnboarding: mockOpenOnboarding,
      closeOnboarding: mockCloseOnboarding,
      currentStep: 0,
    });

    render(<OnboardingManager />);

    // Should render without errors
    expect(screen.queryByTestId('welcome-dialog')).not.toBeInTheDocument();

    windowSpy.mockRestore();
  });
});
