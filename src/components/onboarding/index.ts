/**
 * Onboarding System Exports
 * 
 * Centralized exports for the first-time user onboarding system.
 * Import everything you need from here.
 */

// Core components
export { OnboardingTooltip } from './OnboardingTooltip';
export { OnboardingDemo } from './OnboardingDemo';

// Higher-order components and wrappers
export { OnboardingWrapper, withOnboarding, useOnboardingControl } from './withOnboarding';

// Context and hooks
export { OnboardingProvider, useOnboardingContext, useOnboardingStep } from '../../context/OnboardingContext';

// Main hook
export { useOnboarding } from '../../hooks/useOnboarding';

// Types
export type { OnboardingStep, OnboardingHookReturn } from '../../hooks/useOnboarding';

// Re-export everything for convenience
export * from './OnboardingTooltip';
export * from './OnboardingDemo';
export * from './withOnboarding';
export * from '../../context/OnboardingContext';
export * from '../../hooks/useOnboarding'; 