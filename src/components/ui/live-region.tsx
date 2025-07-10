/**
 * ARIA Live Region Component
 * 
 * Provides screen reader announcements for dynamic content changes.
 * Essential for WCAG 2.1 AA compliance (4.1.3 Status Messages).
 */

'use client';

import { cn } from '@/lib/utils';

interface LiveRegionProps {
  children: React.ReactNode;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
  className?: string;
}

export function LiveRegion({ 
  children, 
  priority = 'polite', 
  atomic = false,
  className 
}: LiveRegionProps) {
  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      className={cn(
        // Visually hidden but accessible to screen readers
        "sr-only",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Status announcements for non-urgent updates
 */
export function StatusAnnouncement({ children, className }: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <LiveRegion priority="polite" className={className}>
      {children}
    </LiveRegion>
  );
}

/**
 * Alert announcements for urgent updates
 */
export function AlertAnnouncement({ children, className }: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <LiveRegion priority="assertive" atomic={true} className={className}>
      {children}
    </LiveRegion>
  );
}

/**
 * Timer announcement component specifically for assessments
 */
export function TimerAnnouncement({ timeRemaining }: { timeRemaining: number | null }) {
  if (timeRemaining === null) return null;

  const minutes = Math.floor(timeRemaining / 60000);
  const isUrgent = timeRemaining < 300000; // 5 minutes

  const announcement = isUrgent 
    ? `Warning: ${minutes} minutes remaining`
    : `${minutes} minutes remaining`;

  return (
    <LiveRegion priority={isUrgent ? 'assertive' : 'polite'}>
      {announcement}
    </LiveRegion>
  );
} 