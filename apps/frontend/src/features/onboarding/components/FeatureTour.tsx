import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '../hooks/useOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FeatureTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeatureTour({ open, onOpenChange }: FeatureTourProps) {
  const { currentStep, isComplete, nextStep, prevStep, getStepContent, completeOnboarding } = useOnboarding();
  const stepContent = getStepContent(currentStep);

  const progress = ((currentStep + 1) / 6) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Feature Tour</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
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
          <div className="text-center">
            <div className="mx-auto w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold">{currentStep + 1}</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{stepContent.title}</h3>
            <p className="text-muted-foreground mb-6">{stepContent.description}</p>
            <div className="flex gap-2 justify-center">
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
                {currentStep < 5 ? stepContent.cta : 'Finish Tour'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}