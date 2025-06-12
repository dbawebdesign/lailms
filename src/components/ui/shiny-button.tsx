'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import './shiny-button.css'

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn("shiny-cta", className)}
        {...props}
      >
        <span className="shiny-content">{children}</span>
      </button>
    )
  }
)

ShinyButton.displayName = "ShinyButton" 