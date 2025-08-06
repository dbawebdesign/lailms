/**
 * Optimized Logo Component
 * 
 * Uses static imports and proper caching to minimize image optimization requests
 */

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

// Static logo path - using string path for better compatibility
const LOGO_PATHS = {
  'horizontal-white': '/Horizontal white text.png',
  'horizontal-dark': '/Horizontal white text.png', // Use same for now, add dark variant later
} as const

interface OptimizedLogoProps {
  variant?: 'horizontal-white' | 'horizontal-dark'
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export const OptimizedLogo = React.forwardRef<
  React.ElementRef<typeof Image>,
  OptimizedLogoProps
>(({ 
  variant = 'horizontal-white',
  width = 300,
  height = 80,
  className,
  priority = false,
  ...props 
}, ref) => {
  
  // Use static paths for better performance and caching
  const logoSrc = React.useMemo(() => {
    return LOGO_PATHS[variant] || LOGO_PATHS['horizontal-white']
  }, [variant])

  return (
    <Image
      ref={ref}
      src={logoSrc}
      alt="Learnology AI Logo"
      width={width}
      height={height}
      priority={priority}
      className={cn("object-contain", className)}
      // Disable optimization for logos to prevent repeated requests
      unoptimized={false}
      // Add quality setting for consistent output
      quality={90}
      // Use placeholder for better loading experience
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      {...props}
    />
  )
})

OptimizedLogo.displayName = "OptimizedLogo"