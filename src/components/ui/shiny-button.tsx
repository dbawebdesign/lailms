'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <>
        <style jsx global>{`
          @property --gradient-angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
          }
          @property --gradient-angle-offset {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
          }
          @property --gradient-percent {
            syntax: "<percentage>";
            initial-value: 20%;
            inherits: false;
          }
          @property --gradient-shine {
            syntax: "<color>";
            initial-value: #E45DE5;
            inherits: false;
          }
          
          .shiny-cta {
            --shiny-cta-bg: #000000;
            --shiny-cta-bg-subtle: #1a1818;
            --shiny-cta-fg: #ffffff;
            --shiny-cta-highlight: #E45DE5;
            position: relative;
            overflow: hidden;
            border-radius: 0.5rem;
            padding: 0.75rem 2rem;
            font-size: 1rem;
            line-height: 1.2;
            font-weight: 500;
            color: var(--shiny-cta-fg);
            background: var(--shiny-cta-bg);
            border: none;
            outline: none;
            cursor: pointer;
            isolation: isolate;
            outline-offset: 4px;
            font-family: inherit;
            z-index: 1;
            white-space: nowrap;
            min-width: fit-content;
          }
          
          /* Rotating border background */
          .shiny-cta::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 0.5rem;
            background: conic-gradient(
              from 0deg,
              transparent 0%,
              transparent 60%,
              #FF835D 70%,
              #E45DE5 80%,
              #6B5DE5 90%,
              transparent 100%
            );
            animation: border-spin 3.5s linear infinite;
            pointer-events: none;
            z-index: -1;
          }
          
          @keyframes border-spin {
            to { 
              transform: rotate(360deg);
            }
          }
          
          .shiny-cta:active {
            transform: translateY(1px);
          }
          
          /* Inner background to create border effect */
          .shiny-cta::after {
            content: '';
            position: absolute;
            inset: 2px;
            border-radius: calc(0.5rem - 2px);
            background: var(--shiny-cta-bg);
            z-index: 0;
            pointer-events: none;
          }
          
          /* Shimmer effect */
          .shiny-cta .shiny-content::after {
            content: '';
            pointer-events: none;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
            width: 200%;
            aspect-ratio: 1;
            background: linear-gradient(-50deg, transparent, var(--shiny-cta-highlight), transparent);
            mask-image: radial-gradient(circle at bottom, transparent 40%, black);
            opacity: 0.6;
            animation: shimmer 4s linear infinite;
            animation-play-state: running;
          }
          
          .shiny-cta .shiny-content {
            position: relative;
            z-index: 2;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .shiny-cta .shiny-content::before {
            content: '';
            pointer-events: none;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: -1;
            width: calc(100% + 1rem);
            height: calc(100% + 1rem);
            box-shadow: inset 0 -1ex 2rem 4px var(--shiny-cta-highlight);
            opacity: 0;
            border-radius: inherit;
            transition: opacity 800ms cubic-bezier(0.25, 1, 0.5, 1);
            animation: breathe 4.5s linear infinite;
          }
          
          @keyframes shimmer {
            to { 
              transform: translate(-50%, -50%) rotate(360deg);
            }
          }
          
          @keyframes breathe {
            0%, 100% { 
              transform: translate(-50%, -50%) scale(1);
            }
            50% { 
              transform: translate(-50%, -50%) scale(1.20);
            }
          }
        `}</style>
        
        <button
          ref={ref}
          className={cn("shiny-cta", className)}
          {...props}
        >
          <span className="shiny-content">{children}</span>
        </button>
      </>
    )
  }
)

ShinyButton.displayName = "ShinyButton" 