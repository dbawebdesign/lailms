"use client";

import React, { useState, useEffect } from "react";
import { User, Bell, Moon, Sun, MessageSquare, LogOut, Mail, Crown, Shield, GraduationCap, BookOpen, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useUIContext } from "@/context/UIContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { triggerChatLogout } from "@/utils/chatPersistence";
import { Tables } from "packages/types/db";
import { PROFILE_ROLE_FIELDS, UserProfile } from "@/lib/utils/roleUtils";

// Custom hover class for consistent brand styling
const buttonHoverClass = "hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10";

// Role icon mapping
const roleIcons = {
  super_admin: Crown,
  admin: Shield,
  teacher: GraduationCap,
  student: BookOpen,
  parent: Users,
}

// Role display names
const roleDisplayNames = {
  super_admin: "Super Admin",
  admin: "Admin", 
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
}

// UserProfile type is now imported from roleUtils above

const Header = () => {
  const { isPanelVisible, togglePanelVisible } = useUIContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isRoleSwitching, setIsRoleSwitching] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        
        // Fetch user profile with roles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(PROFILE_ROLE_FIELDS + ', first_name, last_name')
          .eq('user_id', session.user.id)
          .single<UserProfile>();
          
        if (profile && !error) {
          setUserProfile(profile);
        }
      }
    };
    fetchUser();
  }, [supabase]);

  const handleLogout = async () => {
    // Trigger chat history cleanup before logout
    triggerChatLogout();
    
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleRoleSwitch = async (newRole: UserProfile['role']) => {
    if (!userProfile || isRoleSwitching) return;
    
    setIsRoleSwitching(true);
    
    try {
      const response = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Role switch successful:', result);
        
        // Update local state
        setUserProfile({
          ...userProfile,
          active_role: newRole
        });
        
        // Redirect to appropriate dashboard based on role
        const roleRedirects = {
          super_admin: '/org',
          admin: '/school', 
          teacher: '/teach',
          student: '/learn',
          parent: '/dashboard'
        };
        
        const redirectPath = roleRedirects[newRole as keyof typeof roleRedirects] || '/dashboard';
        
        // Force a full page refresh to ensure layout re-renders with new active_role
        window.location.href = redirectPath;
      } else {
        const error = await response.json();
        console.error('Role switch failed:', error);
        // You could add a toast notification here in the future
        alert(`Failed to switch role: ${error.message || error.error}`);
      }
    } catch (error) {
      console.error('Role switch error:', error);
    } finally {
      setIsRoleSwitching(false);
    }
  };

  // Get current effective role
  const currentRole = userProfile?.active_role || userProfile?.role;
  
  // Get available roles
  const additionalRoles = userProfile?.additional_roles 
    ? (Array.isArray(userProfile.additional_roles) ? userProfile.additional_roles as string[] : [])
    : [];
  const availableRoles = userProfile ? [
    userProfile.role,
    ...additionalRoles
  ].filter((role, index, array) => array.indexOf(role) === index) : [];
  
  // Check if user has multiple roles
  const hasMultipleRoles = availableRoles.length > 1;

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
        
        {/* Role Switcher - Only show for users with multiple roles */}
        {hasMultipleRoles && currentRole && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("flex items-center space-x-2 h-8", buttonHoverClass)}
                disabled={isRoleSwitching}
              >
                {(() => {
                  const IconComponent = roleIcons[currentRole as keyof typeof roleIcons];
                  return IconComponent ? <IconComponent className="h-4 w-4" /> : <User className="h-4 w-4" />;
                })()}
                <span className="text-sm font-medium">
                  {roleDisplayNames[currentRole as keyof typeof roleDisplayNames] || currentRole}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableRoles.map((role) => {
                const IconComponent = roleIcons[role as keyof typeof roleIcons];
                const isActive = role === currentRole;
                
                return (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => handleRoleSwitch(role as UserProfile['role'])}
                    disabled={isActive || isRoleSwitching}
                    className={cn(
                      "flex items-center space-x-2",
                      isActive && "bg-neutral-100 dark:bg-neutral-800"
                    )}
                  >
                    {IconComponent && <IconComponent className="h-4 w-4" />}
                    <span>{roleDisplayNames[role as keyof typeof roleDisplayNames] || role}</span>
                    {isActive && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label="User Menu"
              className={buttonHoverClass}
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">My Account</p>
                {userEmail && (
                  <p className="text-xs leading-none text-muted-foreground">
                    {userEmail}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Possible future items: Profile, Settings */}
            {/* 
            <DropdownMenuItem onSelect={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            */}
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
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