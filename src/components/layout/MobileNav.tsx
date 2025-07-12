"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import navConfig, { NavItem } from "@/config/navConfig";
import { UserRole } from "@/lib/utils/roleUtils";
import { useUIContext } from "@/context/UIContext";
import { MoreHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MobileNavProps {
  userRole: UserRole;
}

const MobileNav: React.FC<MobileNavProps> = ({ userRole }) => {
  const pathname = usePathname();
  const { openFeedbackModal } = useUIContext();

  // Filter nav items based on user role - include bottom items for mobile
  const allUserNavItems = navConfig.filter(
    (item) => item.roles.includes(userRole)
  );

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const handleNavItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.href === '/feedback') {
      e.preventDefault();
      openFeedbackModal({ category: 'feedback', priority: 'medium' });
    }
    // For other items, let the Link handle the navigation naturally
  };

  const maxItemsInBar = 5; // Max 4 direct links + 1 "More" button if needed
  let itemsToShowInBar: NavItem[] = [];
  let itemsForMoreMenu: NavItem[] = [];

  if (allUserNavItems.length <= maxItemsInBar) {
    itemsToShowInBar = allUserNavItems;
  } else {
    itemsToShowInBar = allUserNavItems.slice(0, maxItemsInBar - 1); // Show first 4
    itemsForMoreMenu = allUserNavItems.slice(maxItemsInBar - 1); // Rest go into "More"
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-[#E0E0E0] dark:border-[#333333] p-1 z-40">
      <nav className="flex justify-around items-center">
        {itemsToShowInBar.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => handleNavItemClick(item, e)}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-1 rounded-md text-xs flex-1 min-w-0",
              pathname === item.href
                ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 mb-1",
              pathname === item.href ? "text-white" : "text-muted-foreground"
            )} />
            <span className="text-[10px] truncate w-full text-center">{item.title}</span>
          </Link>
        ))}
        {itemsForMoreMenu.length > 0 && (
          <Sheet open={isMoreSheetOpen} onOpenChange={setIsMoreSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-1 rounded-md text-xs flex-1 min-w-0",
                  "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground"
                )}
              >
                <MoreHorizontal className="h-5 w-5 mb-1 text-muted-foreground" />
                <span className="text-[10px] truncate w-full text-center">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[60vh] flex flex-col rounded-t-lg">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-center">More Options</SheetTitle>
                <SheetClose asChild className="absolute right-2 top-2">
                  <Button variant="ghost" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {itemsForMoreMenu.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      handleNavItemClick(item, e);
                      setIsMoreSheetOpen(false);
                    }}
                    className={cn(
                      "flex items-center py-3 px-4 rounded-md text-sm",
                      pathname === item.href
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 mr-3",
                      pathname === item.href ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </nav>
    </div>
  );
};

export default MobileNav; 