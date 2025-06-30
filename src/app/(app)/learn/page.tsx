'use client';

import { useState, useEffect } from 'react';
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/config/navConfig";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import ActiveCourseItem, { ActiveCourseItemProps } from "@/components/dashboard/student/ActiveCourseItem";
import { Tables } from "packages/types/db";
import { progressEvents } from '@/lib/utils/progressEvents';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface StudentDashboardData {
  userName: string;
  userRole: UserRole;
  activeCourses: ActiveCourseItemProps[];
}

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await fetch('/api/student/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen for progress updates and refresh dashboard data (with debouncing)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = progressEvents.subscribe((event) => {
      console.log('Progress event received on dashboard:', event);
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Debounce the refresh to avoid too many API calls
      timeoutId = setTimeout(() => {
        fetchDashboardData(true); // Mark as refresh
      }, 1500); // Wait 1.5 seconds after the last progress update
    });

    return () => {
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-500 mb-4">Error loading dashboard: {error}</p>
            <Button onClick={() => fetchDashboardData()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <WelcomeCard userName={data.userName} userRole={data.userRole} />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="h-8 w-8 p-0 ml-4"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">My Active Courses</h2>
            {refreshing && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {data.activeCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.activeCourses.map(course => (
                <ActiveCourseItem key={course.id} {...course} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">You are not currently enrolled in any active courses. Explore and join a new course!</p>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Achievements</h2>
          <p className="text-muted-foreground">Your recent badges and achievements.</p>
        </div>
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Join a Class</h2>
          <p className="text-muted-foreground mb-4">Enroll in new classes using enrollment codes from your instructors.</p>
          <Link href="/learn/enroll">
            <Button className="w-full">
              Enroll with Code
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 