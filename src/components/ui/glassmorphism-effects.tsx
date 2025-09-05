/**
 * Glassmorphism Effects Component
 * Provides floating orbs and sparkle effects for premium visual enhancement
 * Integrates with existing design system and respects accessibility preferences
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface FloatingOrbsProps {
  /** Number of orbs to display (1-5) */
  count?: number;
  /** Custom className for styling */
  className?: string;
  /** Whether orbs should be visible (respects reduced motion preference) */
  enabled?: boolean;
}

interface SparklesProps {
  /** Number of sparkles to display (1-10) */
  count?: number;
  /** Custom className for styling */
  className?: string;
  /** Whether sparkles should be visible (respects reduced motion preference) */
  enabled?: boolean;
}

/**
 * Floating Orbs Component
 * Creates animated background orbs using brand colors
 */
export function FloatingOrbs({ 
  count = 3, 
  className,
  enabled = true 
}: FloatingOrbsProps) {
  if (!enabled) return null;

  const orbs = Array.from({ length: Math.min(count, 5) }, (_, i) => (
    <div
      key={i}
      className={cn("floating-orb", className)}
      style={{
        animationDelay: `${-2 * (i + 1)}s`,
        ...(i === 0 && {
          width: '200px',
          height: '200px',
          background: 'linear-gradient(45deg, var(--info), var(--accent))',
          top: '10%',
          right: '20%',
        }),
        ...(i === 1 && {
          width: '300px',
          height: '300px',
          background: 'linear-gradient(45deg, var(--destructive), var(--warning))',
          bottom: '20%',
          left: '10%',
        }),
        ...(i === 2 && {
          width: '150px',
          height: '150px',
          background: 'linear-gradient(45deg, var(--success), var(--info))',
          top: '50%',
          left: '60%',
        }),
        ...(i === 3 && {
          width: '180px',
          height: '180px',
          background: 'linear-gradient(45deg, var(--accent), var(--primary))',
          top: '30%',
          left: '30%',
        }),
        ...(i === 4 && {
          width: '120px',
          height: '120px',
          background: 'linear-gradient(45deg, var(--warning), var(--success))',
          bottom: '40%',
          right: '40%',
        }),
      }}
    />
  ));

  return <>{orbs}</>;
}

/**
 * Sparkles Component
 * Creates animated sparkle effects for magical premium feel
 */
export function Sparkles({ 
  count = 5, 
  className,
  enabled = true 
}: SparklesProps) {
  if (!enabled) return null;

  const sparkles = Array.from({ length: Math.min(count, 10) }, (_, i) => (
    <div
      key={i}
      className={cn("sparkle", className)}
      style={{
        animationDelay: `${i * 0.5}s`,
        ...(i === 0 && { top: '20%', left: '20%' }),
        ...(i === 1 && { top: '40%', right: '30%' }),
        ...(i === 2 && { bottom: '30%', left: '60%' }),
        ...(i === 3 && { top: '60%', right: '20%' }),
        ...(i === 4 && { bottom: '60%', left: '40%' }),
        ...(i === 5 && { top: '15%', left: '70%' }),
        ...(i === 6 && { bottom: '15%', right: '60%' }),
        ...(i === 7 && { top: '70%', left: '15%' }),
        ...(i === 8 && { top: '35%', right: '50%' }),
        ...(i === 9 && { bottom: '45%', left: '80%' }),
      }}
    />
  ));

  return <>{sparkles}</>;
}

interface GlassmorphismContainerProps {
  children: React.ReactNode;
  /** Whether to show floating orbs */
  showOrbs?: boolean;
  /** Whether to show sparkles */
  showSparkles?: boolean;
  /** Number of orbs (1-5) */
  orbCount?: number;
  /** Number of sparkles (1-10) */
  sparkleCount?: number;
  /** Custom className */
  className?: string;
  /** Whether effects are enabled (auto-detects reduced motion preference) */
  effectsEnabled?: boolean;
}

/**
 * Glassmorphism Container
 * Wraps content with optional floating orbs and sparkles
 * Automatically respects user's motion preferences
 */
export function GlassmorphismContainer({
  children,
  showOrbs = false,
  showSparkles = false,
  orbCount = 3,
  sparkleCount = 5,
  className,
  effectsEnabled = true,
}: GlassmorphismContainerProps) {
  return (
    <div className={cn("relative", className)}>
      {showOrbs && (
        <FloatingOrbs 
          count={orbCount} 
          enabled={effectsEnabled}
        />
      )}
      {showSparkles && (
        <Sparkles 
          count={sparkleCount} 
          enabled={effectsEnabled}
        />
      )}
      {children}
    </div>
  );
}

interface AnimatedCardProps extends React.ComponentProps<"div"> {
  /** Animation type */
  animation?: 'fade-in' | 'slide-up' | 'slide-right' | 'scale-in' | 'blur-in';
  /** Animation delay in milliseconds */
  delay?: number;
  /** Whether the card should have hover effects */
  hoverable?: boolean;
  /** Hover gradient colors */
  hoverGradient?: string;
}

/**
 * Animated Card Component
 * Pre-configured card with glassmorphism and animations
 */
export function AnimatedCard({
  children,
  className,
  animation = 'fade-in',
  delay = 0,
  hoverable = true,
  hoverGradient = "linear-gradient(135deg, rgba(107, 93, 229, 0.1) 0%, rgba(228, 93, 229, 0.05) 100%)",
  ...props
}: AnimatedCardProps) {
  const animationClass = `animate-${animation}`;
  const delayClass = delay > 0 ? `delay-${delay}` : '';

  return (
    <div
      className={cn(
        "glass-card",
        hoverable && "glass-card-hover card-hover-gradient",
        animationClass,
        delayClass,
        className
      )}
      style={hoverable ? { "--hover-gradient": hoverGradient } as React.CSSProperties : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Number Counter Component
 * Animated number display with digit flip effects
 */
interface NumberCounterProps {
  value: number | string;
  className?: string;
  /** Animation delay for each digit */
  digitDelay?: number;
}

export function NumberCounter({ 
  value, 
  className,
  digitDelay = 100 
}: NumberCounterProps) {
  const digits = value.toString().split('');

  return (
    <span className={cn("inline-flex", className)}>
      {digits.map((digit, index) => (
        <span
          key={index}
          className="number-digit"
          style={{ "--digit-delay": `${1 + (index * digitDelay / 1000)}s` } as React.CSSProperties}
        >
          {digit}
        </span>
      ))}
    </span>
  );
}

/**
 * Progress Ring Component
 * Animated SVG progress ring
 */
interface ProgressRingProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Ring size */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Ring color */
  color?: string;
  /** Background ring color */
  backgroundColor?: string;
  /** Custom className */
  className?: string;
}

export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  color = "var(--primary)",
  backgroundColor = "rgba(255, 255, 255, 0.1)",
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="progress-ring"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <NumberCounter 
          value={`${Math.round(progress)}%`}
          className="text-xs font-medium text-white/80"
        />
      </div>
    </div>
  );
}
