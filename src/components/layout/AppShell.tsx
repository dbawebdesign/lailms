"use client";

import React from 'react';
import LeftNav from './LeftNav';
import MainContent from './MainContent';
import AiPanel from './AiPanel';
import Header from './Header';
import { useUIContext } from '@/context/UIContext';
import { cn } from '@/lib/utils'; // Assuming you have a cn utility
import CommandPalette from './CommandPalette'; // Import CommandPalette

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { isNavCollapsed, isPanelVisible } = useUIContext();

  return (
    <> {/* Use Fragment to include non-visual CommandPalette */}
      <div className="flex h-screen bg-background text-foreground">
        {/* Left Navigation */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out",
            isNavCollapsed ? "w-16" : "w-60" // 64px / 240px
          )}
        >
          <LeftNav />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <MainContent>{children}</MainContent>
        </div>

        {/* AI Panel */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
            isPanelVisible ? "w-80" : "w-0" // 320px / 0px
          )}
        >
          {isPanelVisible && <AiPanel />}
        </div>
      </div>
      <CommandPalette /> {/* Include CommandPalette here */}
    </>
  );
};

export default AppShell; 