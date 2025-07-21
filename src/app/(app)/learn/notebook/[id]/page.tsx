'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function StudySpaceRedirect() {
  const router = useRouter();
  const params = useParams();
  
  useEffect(() => {
    // Redirect to the unified study space with the space ID as a query parameter
    const spaceId = params.id;
    router.replace(`/learn/notebook?space=${spaceId}`);
  }, [router, params.id]);

  // Show a loading state while redirecting
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your study space...</p>
      </div>
    </div>
  );
} 