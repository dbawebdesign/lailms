'use client';

import React from 'react';
import type { UserRole } from "@/config/navConfig";
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react'; // For a little AI flair

interface WelcomeCardProps {
  userName: string;
  userRole: UserRole;
  // aiInsight?: string; // Optional prop for AI message, can be added later
}

// Helper to get a more descriptive role title
const getRoleTitle = (role: UserRole) => {
  switch (role) {
    case 'student': return 'Student';
    case 'teacher': return 'Teacher';
    case 'admin': return 'Administrator';
    case 'super_admin': return 'Super Administrator';
    case 'parent': return 'Parent';
    default: return 'User';
  }
};

const WelcomeCard: React.FC<WelcomeCardProps> = ({ userName, userRole /*, aiInsight */ }) => {
  const now = new Date();
  const hours = now.getHours();
  let timeOfDayGreeting = "Hello";

  if (hours < 12) {
    timeOfDayGreeting = "Good morning";
  } else if (hours < 18) {
    timeOfDayGreeting = "Good afternoon";
  } else {
    timeOfDayGreeting = "Good evening";
  }

  // Placeholder for AI-powered insight
  const placeholderAiInsight = "Here's a quick tip to get you started today!";

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-lg mb-8 text-white", // Added text-white for better contrast on gradient
      "bg-gradient-to-br from-[#FF835D] via-[#E45DE5] to-[#6B5DE5]", // Brand gradient
      "border border-white/30", // Subtle border for glass effect
      "backdrop-blur-lg" // Glassmorphism backdrop blur
      // Note: backdrop-blur requires something to be behind the element to be visible.
      // If the parent container has a solid background, this specific effect might be less noticeable on the card itself.
    )}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {timeOfDayGreeting}, {userName}!
          </h1>
          <p className="text-md text-white/80">
            Welcome to your {getRoleTitle(userRole)} Dashboard.
          </p>
        </div>
        {/* Optional: Icon or small visual element on the right */}
      </div>

      {/* Adjusted AI insight section for better contrast and glassmorphism feel */}
      <div className="flex items-start p-4 bg-white/10 dark:bg-black/10 rounded-lg border border-white/20 backdrop-blur-sm">
        <Sparkles className="h-6 w-6 mr-3 text-white/90 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-md font-semibold text-white mb-1">AI Powered Insight</h3>
          <p className="text-sm text-white/70">
            {/* aiInsight || placeholderAiInsight */}
            {placeholderAiInsight} {/* Using placeholder for now */}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard; 