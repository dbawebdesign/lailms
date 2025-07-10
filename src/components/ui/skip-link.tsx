/**
 * Skip Navigation Link Component
 * 
 * Provides keyboard users with the ability to skip repetitive navigation
 * and jump directly to main content. Essential for WCAG 2.1 AA compliance.
 */

'use client';

import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Hidden by default, visible on focus
        "absolute left-0 top-0 z-50",
        "transform -translate-y-full",
        "focus:translate-y-0",
        // Styling when visible
        "bg-primary text-primary-foreground",
        "px-4 py-2 text-sm font-medium",
        "border border-primary-foreground/20",
        "rounded-b-md shadow-lg",
        // Focus styles
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Smooth transition
        "transition-transform duration-200 ease-in-out",
        className
      )}
    >
      {children}
    </a>
  );
}

export function SkipToMain() {
  return (
    <SkipLink href="#main-content">
      Skip to main content
    </SkipLink>
  );
}

export function SkipToNavigation() {
  return (
    <SkipLink href="#navigation">
      Skip to navigation
    </SkipLink>
  );
} 