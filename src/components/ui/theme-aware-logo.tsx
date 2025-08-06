/**
 * Theme-Aware Logo Component
 * 
 * Automatically switches between light and dark logos based on theme
 * Uses static serving to avoid image optimization requests
 */

'use client'

import * as React from "react"
import { useTheme } from "next-themes"
import { OptimizedLogo } from "./optimized-logo"

interface ThemeAwareLogoProps {
  width?: number
  height?: number
  className?: string
  priority?: boolean
  /** Force a specific variant regardless of theme */
  forceVariant?: 'horizontal-white' | 'horizontal-dark'
}

export const ThemeAwareLogo = React.forwardRef<
  HTMLDivElement,
  ThemeAwareLogoProps
>(({ 
  width = 300,
  height = 80,
  className,
  priority = false,
  forceVariant,
  ...props 
}, ref) => {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Determine variant with memoization to prevent unnecessary re-renders
  const variant = React.useMemo(() => {
    if (forceVariant) return forceVariant
    if (!mounted) return 'horizontal-white' // Default during SSR
    return resolvedTheme === 'dark' ? 'horizontal-white' : 'horizontal-dark'
  }, [mounted, resolvedTheme, forceVariant])

  return (
    <div ref={ref} {...props}>
      <OptimizedLogo
        variant={variant}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    </div>
  )
})

ThemeAwareLogo.displayName = "ThemeAwareLogo"