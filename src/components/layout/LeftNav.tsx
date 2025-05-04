"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import navConfig, { NavItem, UserRole } from "@/config/navConfig";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
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
  const { isNavCollapsed, toggleNavCollapsed } = useUIContext();
  const pathname = usePathname();
  const userRole = useUserRole();
  const { resolvedTheme } = useTheme(); // Use resolvedTheme for initial state
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted on client before rendering theme stuff
  useEffect(() => {
    setMounted(true);
  }, []);

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
    <TooltipProvider delayDuration={0}>
      <nav
        className={cn(
          "h-full flex flex-col border-r border-[#E0E0E0] dark:border-[#333333] transition-all duration-300 ease-in-out overflow-hidden",
          // isNavCollapsed ? "items-center" : "" // Removed earlier
        )}
        aria-label="Main Navigation"
      >
        {/* Logo */}
        <div className={cn("h-16 flex items-center justify-between border-b border-[#E0E0E0] dark:border-[#333333]", isNavCollapsed ? "justify-center px-2" : "px-4")}>
          {isNavCollapsed ? (
             <Button
               variant="ghost"
               size="icon"
               onClick={toggleNavCollapsed}
               aria-label="Expand Navigation"
               className="h-auto p-0" // Adjust button padding/height
             >
               <Image
                 src={iconLogoSrc}
                 alt="Learnology AI Logo (Collapsed)"
                 width={35}
                 height={35}
                 priority
                 className="transition-all duration-300 ease-in-out"
               />
             </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Image
                  src={fullLogoSrc}
                  alt="Learnology AI Logo (Expanded)"
                  width={132}
                  height={35}
                  priority
                  className="transition-all duration-300 ease-in-out"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleNavCollapsed}
                aria-label="Collapse Navigation"
                className="h-8 w-8" // Smaller button size
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden", // Remove default padding, apply below
          // Use more spacious padding (p-6 = 24px), adjust collapsed padding
          isNavCollapsed ? "p-3 space-y-2" : "p-6 space-y-1"
          )}>
          {filteredNavItems.map((item) => (
            <NavItemLink key={item.href} item={item} pathname={pathname} isCollapsed={isNavCollapsed} />
          ))}
        </div>

        {/* Footer/Settings - Add if needed */}
        {/* <div className="mt-auto border-t p-4"> ... </div> */}
      </nav>
    </TooltipProvider>
  );
};

// Separate component for Nav Item Link with Tooltip logic
interface NavItemLinkProps {
  item: NavItem;
  pathname: string;
  isCollapsed: boolean;
}

const NavItemLink: React.FC<NavItemLinkProps> = ({ item, pathname, isCollapsed }) => {
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  const linkContent = (
     <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md text-sm font-medium transition-colors relative",
          // Use a subtle blue hover effect for inactive items
          isActive ? "" : "hover:bg-blue-100 dark:hover:bg-blue-900/50",
           isActive
            ? "bg-gradient-to-r from-orange-400 via-pink-500 to-blue-500 text-white font-semibold shadow-inner" // Reverted gradient
            : "text-muted-foreground dark:text-gray-400",
           isCollapsed ? "h-10 w-10 justify-center" : "px-3 py-2"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "")} />
        <span className={cn(isCollapsed ? "sr-only" : "")}>{item.title}</span>
     </Link>
  );

  if (isCollapsed) {
    return (
       <Tooltip>
         <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
         <TooltipContent side="right">
           <p>{item.title}</p>
         </TooltipContent>
       </Tooltip>
    );
  }

  return linkContent;

};

export default LeftNav; 