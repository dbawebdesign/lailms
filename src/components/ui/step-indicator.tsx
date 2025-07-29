import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  completed: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStepId: string;
  className?: string;
}

export function StepIndicator({ steps, currentStepId, className }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  const progressPercentage = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className={cn("w-full max-w-5xl mx-auto px-6 py-8", className)}>
      <nav aria-label="Progress" className="relative">
        {/* Background Progress Line */}
        <div 
          className="absolute top-6 h-0.5 bg-gray-200 rounded-full transition-all duration-300"
          style={{ 
            left: '3rem', 
            right: '3rem',
            transform: 'translateY(-50%)'
          }} 
        />
        
        {/* Active Progress Line with smooth animation */}
        <div 
          className="absolute top-6 h-0.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-full transition-all duration-1000 ease-out shadow-sm"
          style={{ 
            left: '3rem',
            width: `calc(${progressPercentage}% * (100% - 6rem) / 100%)`,
            transform: 'translateY(-50%)',
            maxWidth: 'calc(100% - 6rem)'
          }} 
        />

        {/* Steps Container */}
        <ol className="relative flex justify-between items-start">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStepId;
            const isCompleted = step.completed;
            const isPast = index < currentIndex && !isCompleted;
            const isFuture = index > currentIndex && !isCompleted;

            return (
              <li key={step.id} className="flex flex-col items-center relative group">
                {/* Step Circle Container */}
                <div className="relative z-10 mb-6">
                  {/* Outer glow for current step */}
                  {isCurrent && !isCompleted && (
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md scale-150 animate-pulse" />
                  )}
                  
                  {/* Main Step Circle */}
                  <div
                    className={cn(
                      "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500 ease-out backdrop-blur-sm",
                      {
                        // Current step - vibrant blue with enhanced styling
                        "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/25 scale-110 ring-4 ring-blue-500/10": isCurrent && !isCompleted,
                        // Completed step - success green with subtle shadow
                        "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25": isCompleted,
                        // Past incomplete step - muted but still prominent
                        "border-blue-300 bg-blue-50 text-blue-600 shadow-sm": isPast,
                        // Future step - clean and minimal
                        "border-gray-300 bg-white text-gray-400 shadow-sm hover:border-gray-400 hover:shadow-md hover:scale-105": isFuture
                      }
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 drop-shadow-sm" />
                    ) : step.icon ? (
                      <div className="h-5 w-5 flex items-center justify-center drop-shadow-sm">
                        {step.icon}
                      </div>
                    ) : (
                      <span className="text-sm font-bold tracking-wide drop-shadow-sm">{index + 1}</span>
                    )}
                  </div>

                  {/* Subtle pulse animation for current step */}
                  {isCurrent && !isCompleted && (
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping" 
                         style={{ animationDuration: '2s' }} />
                  )}
                </div>

                {/* Step Content with improved typography */}
                <div className="text-center max-w-36 px-2">
                  <div
                    className={cn(
                      "text-sm font-semibold leading-tight transition-all duration-300 mb-1",
                      {
                        "text-blue-700 scale-105": isCurrent && !isCompleted,
                        "text-emerald-700": isCompleted,
                        "text-gray-700": isPast,
                        "text-gray-500": isFuture
                      }
                    )}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div 
                      className={cn(
                        "text-xs leading-snug transition-all duration-300 font-medium",
                        {
                          "text-blue-600": isCurrent && !isCompleted,
                          "text-emerald-600": isCompleted,
                          "text-gray-600": isPast,
                          "text-gray-400": isFuture
                        }
                      )}
                    >
                      {step.description}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
} 