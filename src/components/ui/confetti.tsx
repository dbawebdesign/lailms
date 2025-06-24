'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  trigger?: boolean;
  onComplete?: () => void;
}

export function Confetti({ trigger = true, onComplete }: ConfettiProps) {
  useEffect(() => {
    if (!trigger) return;

    // Create a burst of confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        onComplete?.();
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Create confetti from different positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Cleanup function
    return () => {
      clearInterval(interval);
    };
  }, [trigger, onComplete]);

  return null; // This component doesn't render anything visible
}

export function triggerCelebration(onComplete?: () => void) {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  
  // More vibrant colors for education/success theme
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
  
  const defaults = { 
    startVelocity: 30, 
    spread: 360, 
    ticks: 60, 
    zIndex: 1000,
    colors: colors
  };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Initial burst from center
  confetti({
    ...defaults,
    particleCount: 100,
    origin: { x: 0.5, y: 0.5 },
    spread: 70,
    startVelocity: 50
  });

  // Side bursts
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      onComplete?.();
      return;
    }

    const particleCount = 50 * (timeLeft / duration);

    // Create confetti from different positions with varying effects
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      drift: randomInRange(-1, 1)
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      drift: randomInRange(-1, 1)
    });
  }, 250);

  return () => clearInterval(interval);
} 