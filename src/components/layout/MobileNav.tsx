"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import navConfig from "@/config/navConfig";
import { useUserRole } from "@/hooks/useUserRole";

// Placeholder for useUserRole if it doesn't exist yet
// const useUserRole = () => "student" as const;

const MobileNav = () => {
  const pathname = usePathname();
  const userRole = useUserRole();

  // Filter nav items based on user role
  const filteredNavItems = navConfig.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-[#E0E0E0] dark:border-[#333333] p-1 z-40">
      <nav className="flex justify-around items-center">
        {filteredNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-1 rounded-md text-xs",
              pathname === item.href
                ? "bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white"
                : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10 hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 mb-1",
              pathname === item.href ? "text-white" : "text-muted-foreground"
            )} />
            <span className="text-[10px]">{item.title}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default MobileNav; 