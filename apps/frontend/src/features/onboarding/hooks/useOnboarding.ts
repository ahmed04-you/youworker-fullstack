import { create } from 'zustand';

interface OnboardingState {
  currentStep: number;
  isComplete: boolean;
  steps: string[];
  isOpen: boolean;
  progress: number;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  completeOnboarding: () => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  resetOnboarding: () => void;
  getStepContent: (step: number) => {
    title: string;
    description: string;
    image: string;
    cta: string;
  };
}

const ONBOARDING_KEY = 'onboarding-state';
const TOTAL_STEPS = 6;

const DEFAULT_STEPS = [
  'welcome',
  'chat-basics',
  'voice-features',
  'tools-mcp',
  'documents',
  'analytics',
];

export const useOnboarding = create<OnboardingState>((set, get) => ({
  // Initial state
  currentStep: 0,
  isComplete: false,
  steps: DEFAULT_STEPS,
  isOpen: false,
  progress: 0,

  // Actions
  setStep: (step: number) => {
    const newStep = Math.max(0, Math.min(TOTAL_STEPS - 1, step));
    set({ currentStep: newStep });
    const state = get();
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      currentStep: newStep,
      isComplete: state.isComplete,
      isOpen: state.isOpen,
      progress: state.progress,
    }));
  },

  nextStep: () => {
    const current = get().currentStep;
    if (current < TOTAL_STEPS - 1) {
      get().setStep(current + 1);
    }
  },

  prevStep: () => {
    const current = get().currentStep;
    if (current > 0) {
      get().setStep(current - 1);
    }
  },

  completeOnboarding: () => {
    set({ isComplete: true, currentStep: 0, isOpen: false, progress: 100 });
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      currentStep: 0,
      isComplete: true,
      isOpen: false,
      progress: 100,
    }));
  },

  openOnboarding: () => {
    set({ isOpen: true });
  },

  closeOnboarding: () => {
    set({ isOpen: false });
  },

  resetOnboarding: () => {
    set({ isComplete: false, currentStep: 0, isOpen: false, progress: 0 });
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      currentStep: 0,
      isComplete: false,
      isOpen: false,
      progress: 0,
    }));
  },

  getStepContent: (step: number) => {
    const steps = [
      {
        title: 'Welcome to YouWorker',
        description: 'Your AI assistant for chat, voice, tools, and document management. Let\'s get you started!',
        image: '/api/placeholder/400/300?text=Welcome',
        cta: 'Continue',
      },
      {
        title: 'Chat Interface',
        description: 'Engage in natural conversations with AI models. Start new sessions, send messages, and get intelligent responses.',
        image: '/api/placeholder/400/300?text=Chat',
        cta: 'Got it',
      },
      {
        title: 'Voice Features',
        description: 'Use voice input and output for hands-free interaction. Speak naturally and hear responses in your preferred voice.',
        image: '/api/placeholder/400/300?text=Voice',
        cta: 'Next',
      },
      {
        title: 'AI Tools',
        description: 'Access specialized tools like web search, calculations, unit conversions, and more through MCP servers.',
        image: '/api/placeholder/400/300?text=Tools',
        cta: 'Explore Tools',
      },
      {
        title: 'Document Management',
        description: 'Upload, manage, and query your documents. The AI can reference your files for more relevant responses.',
        image: '/api/placeholder/400/300?text=Documents',
        cta: 'Upload Documents',
      },
      {
        title: 'Analytics Dashboard',
        description: 'Monitor usage, performance, and insights. Track token consumption, tool effectiveness, and ingestion stats.',
        image: '/api/placeholder/400/300?text=Analytics',
        cta: 'View Analytics',
      },
    ];

    return steps[step] || steps[0];
  },
}));
