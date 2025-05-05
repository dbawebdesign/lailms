import React from 'react';
// import { designTokens } from './styleGuide'; // Can use this later for styling
import { cn } from './utils';

// Define basic props extending standard button attributes
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

// Define the Button component
export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        // Example basic styling (replace/extend with your design system)
        'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        'h-9 px-4 py-2', 
        className // Merge with passed className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// If you wanted a default export instead, you would do:
// export default function Button({ ... }) { ... }