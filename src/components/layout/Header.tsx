"use client";

import React, { useState, useEffect } from "react";
import { User, Bell, Moon, Sun, MessageSquare } from "lucide-react";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Custom hover class for consistent brand styling
const buttonHoverClass = "hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10";

const Header = () => {
  const { isPanelVisible, togglePanelVisible } = useUIContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 border-b border-[#E0E0E0] dark:border-[#333333] bg-background sticky top-0 z-10">
      {/* Left Side */}
      <div></div>

      {/* Right Side: Actions */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle Theme"
          // Disable button until mounted to prevent hydration mismatch click
          disabled={!mounted}
          className={buttonHoverClass}
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
        
        {/* Hide notifications on very small screens */}
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Notifications" 
          className={cn("hidden xs:flex", buttonHoverClass)}
        >
          <Bell className="h-5 w-5" />
        </Button>
        
        {/* User Menu Placeholder */}
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="User Menu"
          className={buttonHoverClass}
        >
          <User className="h-5 w-5" />
        </Button>
        
        {/* AI Panel Toggle Button - Enhanced for visibility */}
        <Button
          variant={isPanelVisible ? "secondary" : "ghost"}
          size="icon"
          onClick={togglePanelVisible}
          aria-label={isPanelVisible ? "Close AI Panel" : "Open AI Panel"}
          className={cn("relative", !isPanelVisible && buttonHoverClass)}
        >
          <MessageSquare
            className={cn(
              "h-5 w-5 transition-colors",
              !isPanelVisible ? "text-blue-500" : ""
            )}
            strokeWidth={!isPanelVisible ? 2.5 : 2}
          />
          {isPanelVisible && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </Button>
      </div>
    </header>
  );
};

export default Header; 