"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import navConfig, { NavItem, UserRole } from "@/config/navConfig";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Placeholder for fetching user role - replace with actual logic
const useUserRole = (): UserRole => {
  return "student"; // Hardcode for now
};

const LeftNav = () => {
  const { isNavCollapsed, toggleNavCollapsed, setNavCollapsed } = useUIContext();
  const pathname = usePathname();
  const userRole = useUserRole();
  const { resolvedTheme } = useTheme(); // Use resolvedTheme for initial state
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Ensure component is mounted on client before rendering theme stuff
  useEffect(() => {
    setMounted(true);

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Auto-collapse on small screens
      if (mobile && !isNavCollapsed) {
        setNavCollapsed(true);
      }
    };

    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, [isNavCollapsed, setNavCollapsed]);

  // Filter nav items based on user role
  const filteredNavItems = navConfig.filter((item) =>
    item.roles.includes(userRole)
  );

  // Determine logo based on theme *only after* mount
  const fullLogoSrc = mounted && resolvedTheme === 'dark'
    ? "/Horizontal white text.png"
    : "/Horizontal black text.png"; // Default to light logo before mount / if light theme

  const iconLogoSrc = "/web-app-manifest-512x512.png";

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-background border-r border-[#E0E0E0] dark:border-[#333333]",
        isNavCollapsed ? "items-center" : "items-start"
      )}
      aria-label="Main Navigation"
    >
      {/* Nav Header - Logo and optional collapse button */}
      <div
        className={cn(
          "h-14 sm:h-16 shrink-0 flex items-center border-b border-[#E0E0E0] dark:border-[#333333]",
          isNavCollapsed ? "justify-center w-full px-0" : "justify-between w-full px-4"
        )}
      >
        {/* Logo - switches between full and icon based on collapsed state */}
        <div className="flex items-center">
          {!isNavCollapsed ? (
            <Image
              src={fullLogoSrc}
              alt="LearnologyAI"
              width={160}
              height={32}
              className="py-2"
            />
          ) : (
            <Button
              variant="ghost"
              className="p-0 h-auto"
              onClick={toggleNavCollapsed}
              aria-label="Expand Navigation"
            >
              <Image
                src={iconLogoSrc}
                alt="LearnologyAI"
                width={32}
                height={32}
                className="py-1"
              />
            </Button>
          )}
        </div>

        {/* Nav Collapse Button - Only show on non-collapsed state */}
        {!isNavCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNavCollapsed}
            className="h-8 w-8"
            aria-label="Collapse Navigation"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Close button on mobile when menu is open */}
        {isMobile && !isNavCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleNavCollapsed}
            className="h-8 w-8 absolute right-2 top-2"
            aria-label="Close Navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 w-full overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {filteredNavItems.map((item, index) => (
            <li key={index}>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center py-2 px-3 rounded-md text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white" // Brand gradient for active tab
                          : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground",
                        isNavCollapsed ? "justify-center" : "w-full"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          pathname === item.href ? "text-white" : "text-muted-foreground"
                        )}
                      />
                      {!isNavCollapsed && (
                        <span className="ml-3 truncate">{item.title}</span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {isNavCollapsed && (
                    <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-md">
                      {item.title}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Area - for future profile section or bottom nav items */}
      <div
        className={cn(
          "mt-auto h-16 shrink-0 flex items-center border-t border-[#E0E0E0] dark:border-[#333333]",
          isNavCollapsed ? "justify-center" : "px-4"
        )}
      >
        {/* Placeholder for user profile or additional navigation */}
        {/* This can be expanded later */}
        {/*
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          {!isNavCollapsed && (
            <div className="text-sm">
              <div className="font-medium truncate">User Name</div>
              <div className="text-xs text-muted-foreground truncate">user@example.com</div>
            </div>
          )}
        </div>
        */}
      </div>
    </aside>
  );
};

export default LeftNav; 