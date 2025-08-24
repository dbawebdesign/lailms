'use client';

import React, { useState, useEffect } from 'react';
import type { UserRole } from "@/lib/utils/roleUtils";
import { cn } from '@/lib/utils';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIInsight } from '@/lib/services/ai-insights';

interface WelcomeCardProps {
  userName: string;
  userRole: UserRole;
  hasBaseClasses?: boolean;
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

const WelcomeCard: React.FC<WelcomeCardProps> = ({ userName, userRole, hasBaseClasses = true }) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Fetch insights on component mount
  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const response = await fetch('/api/ai-insights');
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshInsights = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      });
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Error refreshing insights:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', insightId })
      });
      if (response.ok) {
        setInsights(insights.filter(insight => insight.id !== insightId));
      }
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const getInsightIcon = (iconName?: string) => {
    // You can expand this to map icon names to actual icons
    switch (iconName) {
      case 'sparkles':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-lg mb-8 text-white",
      "bg-gradient-to-br from-[#FF835D] via-[#E45DE5] to-[#6B5DE5]",
      "border border-white/30",
      "backdrop-blur-lg"
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
      </div>

      {/* AI Insights Section */}
      <div className="space-y-2">
        {!hasBaseClasses && userRole === 'teacher' ? (
          /* Show only "Create your first class" message for new teacher users */
          <div className="flex items-start p-3 bg-white/10 dark:bg-black/10 rounded-lg border border-white/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 mr-3 text-white/90 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">Get Started</h3>
              <p className="text-xs text-white/70">
                Create your first class to unlock AI-powered insights and personalized recommendations!
              </p>
            </div>
          </div>
        ) : (
          /* Show regular AI insights for users with base classes */
          <>
            {isLoading ? (
              <div className="flex items-start p-3 bg-white/10 dark:bg-black/10 rounded-lg border border-white/20 backdrop-blur-sm animate-pulse">
                <div className="h-5 w-5 bg-white/20 rounded mr-3 flex-shrink-0 mt-0.5"></div>
                <div className="flex-1">
                  <div className="h-3 bg-white/20 rounded w-1/3 mb-1"></div>
                  <div className="h-3 bg-white/20 rounded w-2/3"></div>
                </div>
              </div>
            ) : insights.length > 0 ? (
              insights.map((insight, index) => (
                <div key={insight.id} className="flex items-start p-3 bg-white/10 dark:bg-black/10 rounded-lg border border-white/20 backdrop-blur-sm">
                  <div className="text-white/90 flex-shrink-0 mt-0.5 mr-3">
                    {getInsightIcon(insight.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {insight.title}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        {index === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshInsights}
                            disabled={isRefreshing}
                            className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissInsight(insight.id)}
                          className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-white/70">
                      {insight.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start p-3 bg-white/10 dark:bg-black/10 rounded-lg border border-white/20 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 mr-3 text-white/90 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-white">AI Powered Insights</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshInsights}
                      disabled={isRefreshing}
                      className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                    </Button>
                  </div>
                  <p className="text-xs text-white/70">
                    Click refresh to get personalized insights based on your activity!
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WelcomeCard; 