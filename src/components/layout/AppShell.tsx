"use client";

import React, { useEffect, useState } from 'react';
import LeftNav from './LeftNav';
import MainContent from './MainContent';
import AiPanel from './AiPanel';
import Header from './Header';
import MobileNav from './MobileNav';
import { useUIContext } from '@/context/UIContext';
import { cn } from '@/lib/utils'; // Assuming you have a cn utility
import CommandPalette from './CommandPalette'; // Import CommandPalette
import type { UserRole } from "@/config/navConfig"; // Import UserRole

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole; // Add userRole prop
}

const AppShell: React.FC<AppShellProps> = ({ children, userRole }) => {
  const { isNavCollapsed, isPanelVisible } = useUIContext();
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior based on screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      
      // Removed the code that automatically closes the panel on small screens
    };

    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <> {/* Use Fragment to include non-visual CommandPalette */}
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Left Navigation - hide completely on mobile */}
        <div className="hidden md:block transition-all duration-300 ease-in-out z-20">
          <div className={cn(isNavCollapsed ? "w-16" : "w-60")}>
            <LeftNav userRole={userRole} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className={cn("flex-1 flex flex-col min-h-0", isMobile && "pb-16")}>
          <Header />
          <div className="flex-1 overflow-y-auto">
            <MainContent>{children}</MainContent>
          </div>
        </div>

        {/* AI Panel for Desktop - Part of the flex layout to push content */}
        {!isMobile && isPanelVisible && (
          <div className="w-80 border-l border-[#E0E0E0] dark:border-[#333333] h-screen transition-all duration-300 ease-in-out">
            <AiPanel userRole={userRole} />
          </div>
        )}

        {/* Mobile Nav - Bottom Navigation */}
        <MobileNav userRole={userRole} />
      </div>

      {/* AI Panel for Mobile - Full screen experience */}
      {isMobile && isPanelVisible && (
        <AiPanel userRole={userRole} />
      )}

      <CommandPalette /> {/* Include CommandPalette here */}
    </>
  );
};

export default AppShell; 