"use client";

import { useEffect, useState } from 'react';
import { WelcomeDialog } from '@/features/onboarding';
import { useOnboarding } from '@/features/onboarding';
import { Button } from '@/components/ui/button';
import { HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * OnboardingManager handles the onboarding flow
 * Shows the welcome dialog on first visit
 * Shows a "Resume Tour" button if onboarding is incomplete
 */
export function OnboardingManager() {
  const { isComplete, isOpen, openOnboarding, closeOnboarding, currentStep } = useOnboarding();
  const [shouldShow, setShouldShow] = useState(false);
  const [showResumeTour, setShowResumeTour] = useState(false);
  const [dismissedResume, setDismissedResume] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    // Show onboarding on first visit
    if (!isComplete && typeof window !== 'undefined') {
      const hasVisited = localStorage.getItem('has-visited');
      if (!hasVisited) {
        // Delay showing onboarding to let the app load
        const timer = setTimeout(() => {
          setShouldShow(true);
          openOnboarding();
          localStorage.setItem('has-visited', 'true');
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Show resume tour button if user has visited but not completed onboarding
        const dismissed = localStorage.getItem('dismissed-resume-tour');
        if (!dismissed) {
          setShowResumeTour(true);
        }
      }
    }
  }, [isComplete, openOnboarding]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openOnboarding();
    } else {
      closeOnboarding();
    }
  };

  const handleResumeTour = () => {
    setShowResumeTour(false);
    openOnboarding();
  };

  const handleDismissResume = () => {
    setDismissedResume(true);
    setShowResumeTour(false);
    localStorage.setItem('dismissed-resume-tour', 'true');
  };

  return (
    <>
      <WelcomeDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
      />

      {/* Resume Tour Button - Shows when onboarding incomplete and not currently open */}
      <AnimatePresence>
        {!isComplete && !isOpen && showResumeTour && !dismissedResume && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 left-6 z-40 flex items-center gap-2"
          >
            <Button
              onClick={handleResumeTour}
              className="rounded-full shadow-lg"
              size="lg"
              aria-label="Resume onboarding tour"
            >
              <HelpCircle className="mr-2 h-5 w-5" />
              Resume Tour {currentStep > 0 && `(Step ${currentStep + 1}/6)`}
            </Button>
            <Button
              onClick={handleDismissResume}
              variant="outline"
              size="icon"
              className="rounded-full shadow-lg"
              aria-label="Dismiss resume tour button"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
