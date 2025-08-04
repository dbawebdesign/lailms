'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Handles automatic page refresh after course creation redirect
 * This ensures the course generation widget loads properly
 */
export default function AutoRefreshHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if we're being redirected from course creation
    const fromCourseCreation = searchParams.get('from') === 'course-creation';
    const hasRefreshed = sessionStorage.getItem('dashboard-refreshed');

    if (fromCourseCreation && !hasRefreshed) {
      console.log('Auto-refreshing dashboard after course creation redirect...');
      
      // Mark that we've refreshed to prevent infinite refresh loop
      sessionStorage.setItem('dashboard-refreshed', 'true');
      
      // Clean up the URL parameter and refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('from');
      
      // Use replace to avoid adding to history, then refresh
      window.history.replaceState({}, '', url.toString());
      
      // Small delay to ensure URL is updated, then refresh
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }

    // Clean up the session storage flag after successful load
    // (in case user navigates away and comes back)
    const cleanup = () => {
      sessionStorage.removeItem('dashboard-refreshed');
    };

    // Clean up when user navigates away from the page
    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
    };
  }, [searchParams, router]);

  return null; // This component doesn't render anything
}