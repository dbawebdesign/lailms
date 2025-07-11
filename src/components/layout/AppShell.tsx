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
import { SkipLink } from '@/components/ui/skip-link';
import { FeedbackSupportModal } from '@/components/ui/FeedbackSupportModal';

interface AppShellProps {
  children: React.ReactNode;
  userRole: UserRole; // Add userRole prop
}

const AppShell: React.FC<AppShellProps> = ({ children, userRole }) => {
  const { 
    isNavCollapsed, 
    isPanelVisible, 
    isFeedbackModalOpen,
    closeFeedbackModal,
    feedbackModalCategory,
    feedbackModalPriority
  } = useUIContext();
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
      {/* Skip Navigation Links */}
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#navigation">Skip to navigation</SkipLink>
      {isPanelVisible && <SkipLink href="#ai-panel">Skip to AI assistant</SkipLink>}
      
      <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
        {/* Left Navigation - hide completely on mobile */}
        <div className="hidden md:block transition-all duration-300 ease-in-out z-20 flex-shrink-0">
          <div className={cn(isNavCollapsed ? "w-16" : "w-60")}>
            <LeftNav userRole={userRole} />
          </div>
        </div>

        {/* Main Content Area - Take remaining space between nav and panel */}
        <div className={cn(
          "flex flex-col min-h-0 transition-all duration-300 ease-in-out",
          isMobile && "pb-16",
          // Calculate flex-basis based on available space
          !isMobile && isPanelVisible 
            ? "flex-1 min-w-0" // Allow shrinking but with minimum constraints
            : "flex-1"
        )}
        style={{
          // Ensure minimum width for content area when Luna panel is open
          // This prevents the content from becoming too narrow when both nav and Luna panel are open
          minWidth: !isMobile && isPanelVisible ? '320px' : undefined
        }}>
          <Header />
          <div className="flex-1 min-h-0">
            <MainContent>{children}</MainContent>
          </div>
        </div>

        {/* AI Panel for Desktop - Fixed width, never pushed off screen */}
        {!isMobile && isPanelVisible && (
          <div 
            id="ai-panel"
            className="w-80 min-w-80 max-w-80 border-l border-[#E0E0E0] dark:border-[#333333] h-screen transition-all duration-300 ease-in-out flex-shrink-0 bg-background"
            style={{
              // Ensure panel never goes off screen
              position: 'relative',
              zIndex: 30
            }}
          >
            <AiPanel userRole={userRole} />
          </div>
        )}

        {/* Mobile Nav - Bottom Navigation */}
        <MobileNav userRole={userRole} />
      </div>

      {/* AI Panel for Mobile - Full screen experience */}
      {isMobile && isPanelVisible && (
        <div id="ai-panel-mobile">
          <AiPanel userRole={userRole} />
        </div>
      )}

      <CommandPalette /> {/* Include CommandPalette here */}
      
      {/* Global Feedback Modal */}
      <FeedbackSupportModal
        isOpen={isFeedbackModalOpen}
        onClose={closeFeedbackModal}
        initialCategory={feedbackModalCategory}
        initialPriority={feedbackModalPriority}
      />
    </>
  );
};

export default AppShell; 