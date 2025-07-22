"use client"

import * as React from "react"
import { useTheme } from "next-themes"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { SunIcon } from "@/components/tiptap-icons/sun-icon"
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        aria-label="Loading theme toggle"
        data-style="ghost"
      >
        <SunIcon className="tiptap-button-icon" />
      </Button>
    )
  }

  const isDarkMode = resolvedTheme === 'dark'
  const toggleDarkMode = () => setTheme(isDarkMode ? 'light' : 'dark')

  return (
    <Button
      onClick={toggleDarkMode}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      data-style="ghost"
    >
      {isDarkMode ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
