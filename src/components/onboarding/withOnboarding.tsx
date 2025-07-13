/**
 * Higher-Order Component for Onboarding Integration
 * 
 * This provides a simplified approach to wrapping components with onboarding functionality.
 * For most use cases, using the OnboardingWrapper component directly is recommended.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { OnboardingTooltip } from './OnboardingTooltip';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingStep } from '@/hooks/useOnboarding';

interface OnboardingWrapperProps {
  /** Unique identifier for this onboarding step */
  stepId: string;
  /** Onboarding step configuration */
  step: OnboardingStep;
  /** Element to wrap with onboarding */
  children: React.ReactElement;
  /** Trigger onboarding on hover instead of click */
  triggerOnHover?: boolean;
  /** Delay before showing tooltip (in ms) */
  showDelay?: number;
  /** Auto-close tooltip after specified seconds */
  autoCloseDelay?: number;
  /** Custom className for the wrapper */
  className?: string;
  /** Disable onboarding for this specific component */
  disabled?: boolean;
}

export const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({
  stepId,
  step,
  children,
  triggerOnHover = false,
  showDelay = 300,
  autoCloseDelay,
  className,
  disabled = false
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { shouldShowOnboarding, markStepComplete } = useOnboarding();

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Handle showing tooltip
  const showTooltip = useCallback(() => {
    if (disabled || !shouldShowOnboarding(stepId)) return;
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (showDelay > 0) {
      showTimeoutRef.current = setTimeout(() => {
        setTargetElement(elementRef.current);
        setIsTooltipOpen(true);
      }, showDelay);
    } else {
      setTargetElement(elementRef.current);
      setIsTooltipOpen(true);
    }
  }, [disabled, shouldShowOnboarding, stepId, showDelay]);

  // Handle hiding tooltip
  const hideTooltip = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (triggerOnHover) {
      setIsTooltipOpen(false);
    }
  }, [triggerOnHover]);

  // Handle tooltip completion
  const handleTooltipComplete = useCallback(() => {
    markStepComplete(stepId);
    setIsTooltipOpen(false);
  }, [markStepComplete, stepId]);

  // Handle tooltip close
  const handleTooltipClose = useCallback(() => {
    setIsTooltipOpen(false);
  }, []);

  // Create enhanced props for the child element
  const enhancedProps = {
    ref: (node: HTMLElement) => {
      elementRef.current = node;
      // Handle existing ref if present
      if (typeof children.ref === 'function') {
        children.ref(node);
      } else if (children.ref) {
        (children.ref as React.MutableRefObject<HTMLElement>).current = node;
      }
    },
    className: className ? `${children.props.className || ''} ${className}`.trim() : children.props.className,
    ...(triggerOnHover ? {
      onMouseEnter: (e: React.MouseEvent) => {
        children.props.onMouseEnter?.(e);
        showTooltip();
      },
      onMouseLeave: (e: React.MouseEvent) => {
        children.props.onMouseLeave?.(e);
        hideTooltip();
      }
    } : {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        showTooltip();
      }
    })
  };

  return (
    <>
      {React.cloneElement(children, enhancedProps)}
      
      {isTooltipOpen && (
        <OnboardingTooltip
          isOpen={isTooltipOpen}
          onClose={handleTooltipClose}
          onComplete={handleTooltipComplete}
          step={step}
          targetElement={targetElement}
          autoCloseDelay={autoCloseDelay}
        />
      )}
    </>
  );
};

/**
 * Simple hook for manual onboarding control
 * Use this when you need more control over when/how onboarding appears
 */
export function useOnboardingControl(stepId: string, step: OnboardingStep) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const { shouldShowOnboarding, markStepComplete } = useOnboarding();

  const showOnboarding = useCallback((element: HTMLElement) => {
    if (!shouldShowOnboarding(stepId)) return false;
    
    setTargetElement(element);
    setIsTooltipOpen(true);
    return true;
  }, [shouldShowOnboarding, stepId]);

  const hideOnboarding = useCallback(() => {
    setIsTooltipOpen(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    markStepComplete(stepId);
    setIsTooltipOpen(false);
  }, [markStepComplete, stepId]);

  return {
    isTooltipOpen,
    showOnboarding,
    hideOnboarding,
    completeOnboarding,
    shouldShow: shouldShowOnboarding(stepId),
    TooltipComponent: isTooltipOpen ? (
      <OnboardingTooltip
        isOpen={isTooltipOpen}
        onClose={hideOnboarding}
        onComplete={completeOnboarding}
        step={step}
        targetElement={targetElement}
      />
    ) : null
  };
}

/**
 * @deprecated This HOC has complex TypeScript issues. Use OnboardingWrapper instead.
 * 
 * Example usage:
 * ```tsx
 * <OnboardingWrapper stepId="my-step" step={myStep}>
 *   <Button>Click me</Button>
 * </OnboardingWrapper>
 * ```
 */
export function withOnboarding<P extends object>(
  Component: React.ComponentType<P>,
  stepId: string,
  step: OnboardingStep,
  options?: {
    triggerOnHover?: boolean;
    showDelay?: number;
    autoCloseDelay?: number;
    disabled?: boolean;
  }
) {
  const WrappedComponent = (props: P) => (
    <OnboardingWrapper
      stepId={stepId}
      step={step}
      triggerOnHover={options?.triggerOnHover}
      showDelay={options?.showDelay}
      autoCloseDelay={options?.autoCloseDelay}
      disabled={options?.disabled}
    >
      <Component {...props} />
    </OnboardingWrapper>
  );

  WrappedComponent.displayName = `withOnboarding(${Component.displayName || Component.name})`;
  return WrappedComponent;
} 