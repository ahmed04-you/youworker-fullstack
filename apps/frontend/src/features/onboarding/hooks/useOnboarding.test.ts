import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from './useOnboarding';

describe('useOnboarding', () => {
  const ONBOARDING_KEY = 'onboarding-state';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Reset the store to initial state
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.resetOnboarding();
    });
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useOnboarding());

      expect(result.current.currentStep).toBe(0);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.steps).toHaveLength(6);
    });

    it('should have correct default steps', () => {
      const { result } = renderHook(() => useOnboarding());

      expect(result.current.steps).toEqual([
        'welcome',
        'chat-basics',
        'voice-features',
        'tools-mcp',
        'documents',
        'analytics',
      ]);
    });
  });

  describe('Step Navigation', () => {
    it('should advance to next step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should go back to previous step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(2);
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('should set step directly', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('should not advance past last step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(5); // Last step
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(5);
    });

    it('should not go back past first step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe(0);
    });

    it('should clamp step to valid range when setting directly', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(100);
      });

      expect(result.current.currentStep).toBe(5); // Max step

      act(() => {
        result.current.setStep(-10);
      });

      expect(result.current.currentStep).toBe(0); // Min step
    });
  });

  describe('Modal State', () => {
    it('should open onboarding modal', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.openOnboarding();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should close onboarding modal', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.openOnboarding();
        result.current.closeOnboarding();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Completion', () => {
    it('should mark onboarding as complete', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(3);
        result.current.openOnboarding();
        result.current.completeOnboarding();
      });

      expect(result.current.isComplete).toBe(true);
      expect(result.current.progress).toBe(100);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    it('should reset onboarding state', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(3);
        result.current.openOnboarding();
        result.current.completeOnboarding();
        result.current.resetOnboarding();
      });

      expect(result.current.isComplete).toBe(false);
      expect(result.current.currentStep).toBe(0);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.progress).toBe(0);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should persist step to localStorage', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(2);
      });

      const stored = localStorage.getItem(ONBOARDING_KEY);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.currentStep).toBe(2);
    });

    it('should persist completion state to localStorage', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.completeOnboarding();
      });

      const stored = localStorage.getItem(ONBOARDING_KEY);
      const parsed = JSON.parse(stored!);

      expect(parsed.isComplete).toBe(true);
      expect(parsed.progress).toBe(100);
    });

    it('should persist reset to localStorage', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.completeOnboarding();
        result.current.resetOnboarding();
      });

      const stored = localStorage.getItem(ONBOARDING_KEY);
      const parsed = JSON.parse(stored!);

      expect(parsed.isComplete).toBe(false);
      expect(parsed.currentStep).toBe(0);
      expect(parsed.progress).toBe(0);
    });

    it('should persist open state to localStorage when setting step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.openOnboarding();
        result.current.setStep(1);
      });

      const stored = localStorage.getItem(ONBOARDING_KEY);
      const parsed = JSON.parse(stored!);

      expect(parsed.isOpen).toBe(true);
    });
  });

  describe('Step Content', () => {
    it('should return correct content for each step', () => {
      const { result } = renderHook(() => useOnboarding());

      const step0 = result.current.getStepContent(0);
      expect(step0.title).toBe('Welcome to YouWorker');
      expect(step0.cta).toBe('Continue');

      const step1 = result.current.getStepContent(1);
      expect(step1.title).toBe('Chat Interface');
      expect(step1.cta).toBe('Got it');

      const step2 = result.current.getStepContent(2);
      expect(step2.title).toBe('Voice Features');

      const step3 = result.current.getStepContent(3);
      expect(step3.title).toBe('AI Tools');

      const step4 = result.current.getStepContent(4);
      expect(step4.title).toBe('Document Management');

      const step5 = result.current.getStepContent(5);
      expect(step5.title).toBe('Analytics Dashboard');
    });

    it('should return default content for invalid step', () => {
      const { result } = renderHook(() => useOnboarding());

      const invalidStep = result.current.getStepContent(99);
      expect(invalidStep.title).toBe('Welcome to YouWorker');
    });

    it('should have all required fields in step content', () => {
      const { result } = renderHook(() => useOnboarding());

      for (let i = 0; i < 6; i++) {
        const content = result.current.getStepContent(i);
        expect(content).toHaveProperty('title');
        expect(content).toHaveProperty('description');
        expect(content).toHaveProperty('image');
        expect(content).toHaveProperty('cta');

        expect(typeof content.title).toBe('string');
        expect(typeof content.description).toBe('string');
        expect(typeof content.image).toBe('string');
        expect(typeof content.cta).toBe('string');

        expect(content.title).not.toBe('');
        expect(content.description).not.toBe('');
        expect(content.cta).not.toBe('');
      }
    });
  });

  describe('Complete User Flow', () => {
    it('should simulate complete onboarding flow', () => {
      const { result } = renderHook(() => useOnboarding());

      // User starts onboarding
      act(() => {
        result.current.openOnboarding();
      });
      expect(result.current.isOpen).toBe(true);
      expect(result.current.currentStep).toBe(0);

      // User navigates through steps
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.nextStep();
        });
        expect(result.current.currentStep).toBe(i + 1);
      }

      // User completes onboarding at last step
      act(() => {
        result.current.completeOnboarding();
      });

      expect(result.current.isComplete).toBe(true);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.progress).toBe(100);
    });

    it('should allow resuming incomplete onboarding', () => {
      const { result } = renderHook(() => useOnboarding());

      // User starts and completes a few steps
      act(() => {
        result.current.openOnboarding();
        result.current.nextStep();
        result.current.nextStep();
        result.current.closeOnboarding(); // User closes modal
      });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.isComplete).toBe(false);

      // Later, user reopens
      act(() => {
        result.current.openOnboarding();
      });

      expect(result.current.currentStep).toBe(2); // Resumes at step 2
      expect(result.current.isOpen).toBe(true);
    });

    it('should allow going back and forth between steps', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.nextStep();
        result.current.nextStep();
        result.current.nextStep();
      });
      expect(result.current.currentStep).toBe(3);

      act(() => {
        result.current.prevStep();
        result.current.prevStep();
      });
      expect(result.current.currentStep).toBe(1);

      act(() => {
        result.current.nextStep();
      });
      expect(result.current.currentStep).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid navigation calls', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.nextStep();
        result.current.nextStep();
        result.current.prevStep();
        result.current.nextStep();
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('should handle setting step while modal is closed', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(2);
      });

      expect(result.current.currentStep).toBe(2);
      expect(result.current.isOpen).toBe(false);
    });

    it('should maintain state when completing from middle step', () => {
      const { result } = renderHook(() => useOnboarding());

      act(() => {
        result.current.setStep(3);
        result.current.completeOnboarding();
      });

      expect(result.current.isComplete).toBe(true);
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('Zustand Store Behavior', () => {
    it('should share state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useOnboarding());
      const { result: result2 } = renderHook(() => useOnboarding());

      act(() => {
        result1.current.setStep(3);
      });

      expect(result1.current.currentStep).toBe(3);
      expect(result2.current.currentStep).toBe(3);
    });

    it('should update all subscribers when state changes', () => {
      const { result: result1 } = renderHook(() => useOnboarding());
      const { result: result2 } = renderHook(() => useOnboarding());

      act(() => {
        result1.current.completeOnboarding();
      });

      expect(result1.current.isComplete).toBe(true);
      expect(result2.current.isComplete).toBe(true);
      expect(result1.current.progress).toBe(100);
      expect(result2.current.progress).toBe(100);
    });
  });
});
