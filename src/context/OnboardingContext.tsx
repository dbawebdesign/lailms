/**
 * Onboarding Context Provider
 * 
 * Provides global onboarding state and management across the application.
 * Integrates with user preferences and Supabase for persistent tracking.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useOnboarding, OnboardingHookReturn } from '@/hooks/useOnboarding';

interface OnboardingContextProps {
  children: ReactNode;
  /** Total number of onboarding steps for completion tracking */
  totalSteps?: number;
  /** Disable onboarding globally */
  disabled?: boolean;
}

const OnboardingContext = createContext<OnboardingHookReturn | null>(null);

export const OnboardingProvider: React.FC<OnboardingContextProps> = ({
  children,
  totalSteps = 50, // Reasonable default for a comprehensive app
  disabled = false
}) => {
  const onboardingState = useOnboarding(totalSteps);

  // Override with disabled state if needed
  const contextValue = {
    ...onboardingState,
    isOnboardingEnabled: disabled ? false : onboardingState.isOnboardingEnabled,
    shouldShowOnboarding: disabled ? () => false : onboardingState.shouldShowOnboarding
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = (): OnboardingHookReturn => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }
  return context;
};

// Convenience hook for checking if onboarding should be shown
export const useOnboardingStep = (stepId: string) => {
  const { shouldShowOnboarding, markStepComplete } = useOnboardingContext();
  
  return {
    shouldShow: shouldShowOnboarding(stepId),
    markComplete: () => markStepComplete(stepId)
  };
}; 