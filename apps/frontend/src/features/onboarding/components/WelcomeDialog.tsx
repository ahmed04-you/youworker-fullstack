import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '../hooks/useOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const { currentStep, isComplete, nextStep, prevStep, getStepContent, completeOnboarding } = useOnboarding();
  const stepContent = getStepContent(currentStep);

  const progress = ((currentStep + 1) / 6) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Welcome to YouWorker</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Skip
            </Button>
          </div>
          {!isComplete && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Step {currentStep + 1} of 6</p>
              <Progress value={progress} className="h-1" />
            </div>
          )}
        </DialogHeader>
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="mx-auto w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-4"
              >
                <span className="text-3xl font-bold">{currentStep + 1}</span>
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-xl font-semibold mb-2"
              >
                {stepContent.title}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-muted-foreground mb-6"
              >
                {stepContent.description}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="flex gap-2 justify-center"
              >
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex-1 max-w-xs"
                >
                  Back
                </Button>
                <Button
                  onClick={currentStep < 5 ? nextStep : completeOnboarding}
                  className="flex-1 max-w-xs"
                >
                  {currentStep < 5 ? stepContent.cta : 'Finish'}
                </Button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}