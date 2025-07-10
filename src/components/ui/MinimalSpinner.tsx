'use client';

import React from 'react';

interface MinimalSpinnerProps {
  size?: number; // size in pixels
  color?: string; // Tailwind color class e.g., 'text-primary'
}

const MinimalSpinner: React.FC<MinimalSpinnerProps> = ({
  size = 24,
  color = 'text-foreground', // Default to current text color, usually primary or accent
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-spin ${color}`}
      style={{ animationDuration: '0.8s' }} // Slightly slower for elegance
    >
      <path
        d="M12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 9.97089 20.6028 8.07991 19.4551 6.54488"
        stroke="currentColor"
        strokeWidth="2.5" // Slightly thicker for better visibility
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default MinimalSpinner; 