/**
 * Premium Onboarding Tooltip Component
 * 
 * Provides contextual, first-time-only guidance with premium design
 * inspired by Apple, Tesla, and OpenAI interfaces.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Sparkles, Zap, Target, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingStep } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (stepId: string) => void;
  step: OnboardingStep;
  targetElement?: HTMLElement | null;
  className?: string;
  /** Show animation on first appearance */
  showEntrance?: boolean;
  /** Auto-close after specified seconds */
  autoCloseDelay?: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  arrowPosition?: {
    top?: number;
    left?: number;
    transform?: string;
  };
}

export const OnboardingTooltip: React.FC<OnboardingTooltipProps> = ({
  isOpen,
  onClose,
  onComplete,
  step,
  targetElement,
  className,
  showEntrance = true,
  autoCloseDelay
}) => {
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate optimal position for tooltip
  const calculatePosition = useCallback((): TooltipPosition | null => {
    if (!targetElement || !tooltipRef.current) {
      return null;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    const spacing = 16; // Space between tooltip and target
    const arrowSize = 8;
    const minMargin = 16; // Minimum margin from viewport edges

    // Calculate available space in each direction
    const spaceTop = targetRect.top - spacing - tooltipRect.height;
    const spaceBottom = viewport.height - targetRect.bottom - spacing - tooltipRect.height;
    const spaceLeft = targetRect.left - spacing - tooltipRect.width;
    const spaceRight = viewport.width - targetRect.right - spacing - tooltipRect.width;

    let placement: TooltipPosition['placement'] = step.placement || 'top';
    let top = 0;
    let left = 0;
    let arrowPosition: TooltipPosition['arrowPosition'] = {};

    // Determine best placement based on available space
    if (step.placement === 'auto' || !step.placement) {
      if (spaceTop >= 0) placement = 'top';
      else if (spaceBottom >= 0) placement = 'bottom';
      else if (spaceRight >= 0) placement = 'right';
      else if (spaceLeft >= 0) placement = 'left';
      else placement = 'center';
    } else {
      placement = step.placement;
    }

    // Calculate position based on placement
    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - spacing;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        arrowPosition = {
          top: tooltipRect.height - 1,
          left: tooltipRect.width / 2 - arrowSize,
          transform: 'rotate(45deg)'
        };
        break;

      case 'bottom':
        top = targetRect.bottom + spacing;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        arrowPosition = {
          top: -arrowSize,
          left: tooltipRect.width / 2 - arrowSize,
          transform: 'rotate(45deg)'
        };
        break;

      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - spacing;
        arrowPosition = {
          top: tooltipRect.height / 2 - arrowSize,
          left: tooltipRect.width - 1,
          transform: 'rotate(45deg)'
        };
        break;

      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + spacing;
        arrowPosition = {
          top: tooltipRect.height / 2 - arrowSize,
          left: -arrowSize,
          transform: 'rotate(45deg)'
        };
        break;

      case 'center':
        top = (viewport.height - tooltipRect.height) / 2;
        left = (viewport.width - tooltipRect.width) / 2;
        arrowPosition = undefined; // No arrow for center placement
        break;
    }

    // Ensure tooltip stays within viewport bounds
    if (left < minMargin) left = minMargin;
    if (left + tooltipRect.width > viewport.width - minMargin) {
      left = viewport.width - tooltipRect.width - minMargin;
    }
    if (top < minMargin) top = minMargin;
    if (top + tooltipRect.height > viewport.height - minMargin) {
      top = viewport.height - tooltipRect.height - minMargin;
    }

    return {
      top: top + viewport.scrollY,
      left: left + viewport.scrollX,
      placement,
      arrowPosition
    };
  }, [targetElement, step.placement]);

  // Update position when tooltip opens or target changes
  useEffect(() => {
    if (isOpen && targetElement) {
      const updatePosition = () => {
        const newPosition = calculatePosition();
        setPosition(newPosition);
      };

      updatePosition();
      
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen, targetElement, calculatePosition]);

  // Handle visibility state
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Auto-close functionality
  useEffect(() => {
    if (isOpen && autoCloseDelay && autoCloseDelay > 0) {
      autoCloseTimeoutRef.current = setTimeout(() => {
        onComplete(step.id);
      }, autoCloseDelay * 1000);
    }

    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
    };
  }, [isOpen, autoCloseDelay, onComplete, step.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onComplete(step.id);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onComplete, step.id]);

  const getStepIcon = () => {
    switch (step.actionType) {
      case 'action':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'feature-highlight':
        return <Target className="w-4 h-4 text-purple-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-green-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  const getActionTypeColor = () => {
    switch (step.actionType) {
      case 'action':
        return 'from-blue-500/20 to-blue-600/20 border-blue-500/30';
      case 'feature-highlight':
        return 'from-purple-500/20 to-purple-600/20 border-purple-500/30';
      case 'info':
        return 'from-green-500/20 to-green-600/20 border-green-500/30';
      default:
        return 'from-amber-500/20 to-amber-600/20 border-amber-500/30';
    }
  };

  const getActionButtonText = () => {
    switch (step.actionType) {
      case 'action':
        return 'Try it now';
      case 'feature-highlight':
        return 'Got it';
      case 'info':
        return 'Understood';
      default:
        return 'Continue';
    }
  };

  if (!isVisible || !position) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop overlay for center placement */}
          {position.placement === 'center' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
              onClick={onClose}
            />
          )}

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            initial={showEntrance ? { 
              opacity: 0, 
              scale: 0.8,
              y: position.placement === 'top' ? 10 : position.placement === 'bottom' ? -10 : 0,
              x: position.placement === 'left' ? 10 : position.placement === 'right' ? -10 : 0
            } : { opacity: 1, scale: 1 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
              x: 0
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.8,
              y: position.placement === 'top' ? -10 : position.placement === 'bottom' ? 10 : 0,
              x: position.placement === 'left' ? -10 : position.placement === 'right' ? 10 : 0
            }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.3
            }}
            className={cn(
              "fixed z-[9999] max-w-sm w-full",
              "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl",
              "border border-gray-200/60 dark:border-gray-700/60",
              "rounded-2xl shadow-2xl",
              "p-6",
              className
            )}
            style={{
              top: position.top,
              left: position.left,
              filter: 'drop-shadow(0 25px 25px rgb(0 0 0 / 0.15))',
            }}
            role="tooltip"
            aria-live="polite"
            aria-describedby={`tooltip-${step.id}`}
          >
            {/* Arrow */}
            {position.arrowPosition && (
              <div
                className="absolute w-4 h-4 bg-white/95 dark:bg-gray-900/95 border border-gray-200/60 dark:border-gray-700/60"
                style={{
                  top: position.arrowPosition.top,
                  left: position.arrowPosition.left,
                  transform: position.arrowPosition.transform,
                  zIndex: -1
                }}
              />
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full",
                  "bg-gradient-to-r",
                  getActionTypeColor()
                )}>
                  {getStepIcon()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                    {step.title}
                  </h3>
                  {step.category && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {step.category}
                    </span>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                aria-label="Close tooltip"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p 
                id={`tooltip-${step.id}`}
                className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
              >
                {step.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs px-3 py-1.5 h-auto border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Skip
              </Button>
              
              <Button
                onClick={() => onComplete(step.id)}
                size="sm"
                className={cn(
                  "text-xs px-4 py-1.5 h-auto",
                  "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
                  "text-white border-0 shadow-lg",
                  "transition-all duration-200 ease-out",
                  "hover:shadow-xl hover:scale-105"
                )}
              >
                {getActionButtonText()}
                <ArrowRight className="w-3 h-3 ml-1.5" />
              </Button>
            </div>

            {/* Progress indicator for multi-step flows */}
            {step.totalSteps && step.currentStep && (
              <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Step {step.currentStep} of {step.totalSteps}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: step.totalSteps }, (_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          i < step.currentStep 
                            ? "bg-blue-500" 
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}; 