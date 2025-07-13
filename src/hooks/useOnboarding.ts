import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  showArrow?: boolean;
  actionType?: 'info' | 'action' | 'feature-highlight';
  nextSteps?: string[];
  category?: string; // e.g., 'navigation', 'content', 'actions'
  // Multi-step flow support
  totalSteps?: number;
  currentStep?: number;
}

export interface OnboardingState {
  completedSteps: Set<string>;
  isFirstSession: boolean;
  lastActive: Date | null;
}

export interface OnboardingHookReturn {
  // State
  isOnboardingEnabled: boolean;
  completedSteps: Set<string>;
  isFirstSession: boolean;
  
  // Actions
  markStepComplete: (stepId: string) => Promise<void>;
  shouldShowOnboarding: (stepId: string) => boolean;
  initializeOnboarding: () => Promise<void>;
  disableOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  
  // Utilities
  getCompletionRate: () => number;
  getNextStep: (currentStepId: string, category?: string) => string | null;
}

const ONBOARDING_STORAGE_KEY = 'learnology-onboarding';

export const useOnboarding = (totalSteps?: number): OnboardingHookReturn => {
  const [isOnboardingEnabled, setIsOnboardingEnabled] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Initialize onboarding state from user profile
  const initializeOnboarding = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Guest mode - use localStorage
        const localData = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (localData) {
          const parsed = JSON.parse(localData);
          setCompletedSteps(new Set(parsed.completedSteps || []));
          setIsOnboardingEnabled(parsed.isEnabled ?? true);
          setIsFirstSession(parsed.isFirstSession ?? true);
        } else {
          setIsFirstSession(true);
          setIsOnboardingEnabled(true);
        }
        return;
      }

      // Authenticated user - use database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching onboarding state:', error);
        setIsFirstSession(true);
        setIsOnboardingEnabled(true);
        return;
      }

      const onboardingData = profile?.settings?.onboarding || {};
      const completed = new Set<string>(onboardingData.completedSteps || []);
      const isEnabled = onboardingData.isEnabled ?? true;
      const isFirst = onboardingData.isFirstSession ?? true;

      setCompletedSteps(completed);
      setIsOnboardingEnabled(isEnabled);
      setIsFirstSession(isFirst);

      // If this is truly a first session, mark it as not first anymore
      if (isFirst && completed.size === 0) {
        await updateOnboardingSettings({
          ...onboardingData,
          isFirstSession: false,
          lastActive: new Date().toISOString()
        });
        setIsFirstSession(false);
      }

    } catch (error) {
      console.error('Error initializing onboarding:', error);
      setIsFirstSession(true);
      setIsOnboardingEnabled(true);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Update onboarding settings in database or localStorage
  const updateOnboardingSettings = async (newSettings: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Guest mode - use localStorage
      const localData = {
        completedSteps: Array.from(completedSteps),
        isEnabled: isOnboardingEnabled,
        isFirstSession: isFirstSession,
        lastActive: new Date().toISOString(),
        ...newSettings
      };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(localData));
      return;
    }

    // Authenticated user - update database
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    const currentSettings = profile?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      onboarding: {
        ...currentSettings.onboarding,
        ...newSettings
      }
    };

    const { error } = await supabase
      .from('profiles')
      .update({ settings: updatedSettings })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating onboarding settings:', error);
    }
  };

  // Mark a step as complete
  const markStepComplete = useCallback(async (stepId: string) => {
    if (completedSteps.has(stepId)) return;

    const newCompletedSteps = new Set([...completedSteps, stepId]);
    setCompletedSteps(newCompletedSteps);

    await updateOnboardingSettings({
      completedSteps: Array.from(newCompletedSteps),
      lastActive: new Date().toISOString()
    });
  }, [completedSteps, updateOnboardingSettings]);

  // Check if onboarding should be shown for a step
  const shouldShowOnboarding = useCallback((stepId: string): boolean => {
    if (!isOnboardingEnabled || isLoading) return false;
    return !completedSteps.has(stepId);
  }, [isOnboardingEnabled, completedSteps, isLoading]);

  // Disable onboarding completely
  const disableOnboarding = useCallback(async () => {
    setIsOnboardingEnabled(false);
    await updateOnboardingSettings({
      isEnabled: false,
      disabledAt: new Date().toISOString()
    });
  }, [updateOnboardingSettings]);

  // Reset onboarding (for testing or user request)
  const resetOnboarding = useCallback(async () => {
    setCompletedSteps(new Set());
    setIsOnboardingEnabled(true);
    setIsFirstSession(true);
    
    await updateOnboardingSettings({
      completedSteps: [],
      isEnabled: true,
      isFirstSession: true,
      resetAt: new Date().toISOString()
    });
  }, [updateOnboardingSettings]);

  // Get completion rate
  const getCompletionRate = useCallback((): number => {
    if (!totalSteps || totalSteps === 0) return 0;
    return (completedSteps.size / totalSteps) * 100;
  }, [completedSteps.size, totalSteps]);

  // Get next suggested step (basic implementation)
  const getNextStep = useCallback((currentStepId: string, category?: string): string | null => {
    // This could be enhanced with more sophisticated logic
    // For now, return null (let the UI component handle sequencing)
    return null;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeOnboarding();
  }, [initializeOnboarding]);

  return {
    isOnboardingEnabled,
    completedSteps,
    isFirstSession,
    markStepComplete,
    shouldShowOnboarding,
    initializeOnboarding,
    disableOnboarding,
    resetOnboarding,
    getCompletionRate,
    getNextStep
  };
}; 