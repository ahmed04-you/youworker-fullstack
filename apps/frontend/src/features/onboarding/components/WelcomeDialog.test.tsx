import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WelcomeDialog } from './WelcomeDialog';
import { useOnboarding } from '../hooks/useOnboarding';

// Mock the onboarding hook
vi.mock('../hooks/useOnboarding', () => ({
  useOnboarding: vi.fn(),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('WelcomeDialog', () => {
  const mockNextStep = vi.fn();
  const mockPrevStep = vi.fn();
  const mockCompleteOnboarding = vi.fn();
  const mockOnOpenChange = vi.fn();

  const defaultStepContent = {
    title: 'Welcome to YouWorker',
    description: 'Get started with your AI assistant',
    cta: 'Next',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open is true', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    // Use getAllByText and check that at least one element exists
    const elements = screen.getAllByText('Welcome to YouWorker');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('does not render when open is false', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: false,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 0,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    const { container } = render(<WelcomeDialog open={false} onOpenChange={mockOnOpenChange} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('displays current step content', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => ({
        title: 'Step Title',
        description: 'Step Description',
        cta: 'Continue',
      }),
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Step Title')).toBeInTheDocument();
    expect(screen.getByText('Step Description')).toBeInTheDocument();
  });

  it('displays progress bar with correct value', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 2,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 50,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
  });

  it('calls nextStep when Next button is clicked', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    expect(mockNextStep).toHaveBeenCalledTimes(1);
  });

  it('calls prevStep when Back button is clicked', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 2,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 50,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockPrevStep).toHaveBeenCalledTimes(1);
  });

  it('disables Back button on first step', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeDisabled();
  });

  it('enables Back button on subsequent steps', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 1,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 33.33,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).not.toBeDisabled();
  });

  it('shows Finish button on last step', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 5,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => ({
        title: 'Final Step',
        description: 'You are ready to go!',
        cta: 'Get Started',
      }),
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 100,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
  });

  it('calls completeOnboarding when Finish button is clicked', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 5,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 100,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const finishButton = screen.getByRole('button', { name: /finish/i });
    fireEvent.click(finishButton);

    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange when Skip button is clicked', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const skipButton = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('displays step number indicator', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 2,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 50,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('3')).toBeInTheDocument(); // currentStep + 1
  });

  it('hides progress bar when onboarding is complete', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 5,
      isComplete: true,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 100,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText('Step 6 of 6')).not.toBeInTheDocument();
  });

  it('displays custom CTA text from step content', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => ({
        title: 'Step Title',
        description: 'Step Description',
        cta: 'Continue Learning',
      }),
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByRole('button', { name: /continue learning/i })).toBeInTheDocument();
  });

  it('updates progress percentage correctly for different steps', () => {
    const { rerender } = render(
      <WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />
    );

    // Step 1
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    rerender(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();

    // Step 4
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 3,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 66.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    rerender(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);
    expect(screen.getByText('Step 4 of 6')).toBeInTheDocument();
  });

  it('renders with correct max width class', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    const { container } = render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);
    const dialogContent = container.querySelector('.max-w-2xl');
    expect(dialogContent).toBeInTheDocument();
  });

  it('renders with overflow-y-auto for scrollable content', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    const { container } = render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);
    const dialogContent = container.querySelector('.overflow-y-auto');
    expect(dialogContent).toBeInTheDocument();
  });

  it('handles rapid navigation between steps', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 2,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 50,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    const backButton = screen.getByRole('button', { name: /back/i });

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(backButton);

    expect(mockNextStep).toHaveBeenCalledTimes(2);
    expect(mockPrevStep).toHaveBeenCalledTimes(1);
  });

  it('renders dialog header with title', () => {
    vi.mocked(useOnboarding).mockReturnValue({
      currentStep: 0,
      isComplete: false,
      nextStep: mockNextStep,
      prevStep: mockPrevStep,
      getStepContent: () => defaultStepContent,
      completeOnboarding: mockCompleteOnboarding,
      isOpen: true,
      openOnboarding: vi.fn(),
      closeOnboarding: vi.fn(),
      goToStep: vi.fn(),
      resetOnboarding: vi.fn(),
      progress: 16.67,
      steps: ['welcome', 'chat-basics', 'voice-features', 'tools-mcp', 'documents', 'analytics'],
    });

    render(<WelcomeDialog open={true} onOpenChange={mockOnOpenChange} />);

    // Use getAllByText to handle multiple instances
    const elements = screen.getAllByText('Welcome to YouWorker');
    expect(elements.length).toBeGreaterThan(0);
  });
});
