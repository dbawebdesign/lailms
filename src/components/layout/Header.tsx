"use client";

import React, { useState, useEffect } from "react";
import { PanelRight, User, Bell, Moon, Sun, MessageSquare } from "lucide-react";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Header = () => {
  const { isPanelVisible, togglePanelVisible } = useUIContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-[#E0E0E0] dark:border-[#333333] bg-background sticky top-0 z-10">
      {/* Left Side: Nav Toggle Removed */}
      {/* Placeholder for Left Side Content if needed */}
      <div></div>

      {/* Right Side: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle Theme"
          // Disable button until mounted to prevent hydration mismatch click
          disabled={!mounted}
        >
          {/* Only render the icon based on theme after mounting */}
          {mounted && (theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          ))}
          {/* Optional: Render a placeholder or nothing before mount */}
          {!mounted && <div className="h-5 w-5" /> }
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        {/* User Menu Placeholder */}
        <Button variant="ghost" size="icon" aria-label="User Menu">
          <User className="h-5 w-5" />
        </Button>
        {/* AI Panel Toggle Button */}
         <Button
          variant="ghost"
          size="icon"
          onClick={togglePanelVisible}
          aria-label={isPanelVisible ? "Collapse AI Panel" : "Expand AI Panel"}
        >
          <MessageSquare
             className={cn(
               "h-5 w-5 transition-colors",
               !isPanelVisible ? "text-blue-500" : "" // Use blueish/purplish accent color
             )}
             strokeWidth={!isPanelVisible ? 2.5 : 2} // Keep boldness change
          />
        </Button>
      </div>
    </header>
  );
};

export default Header; 