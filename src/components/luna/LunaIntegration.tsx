"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SupabaseEnhancedLunaChat } from './SupabaseEnhancedLunaChat';
import { UserRole } from '@/lib/utils/roleUtils';

interface LunaIntegrationProps {
  userRole: UserRole;
  isMobile?: boolean;
}

export const LunaIntegration: React.FC<LunaIntegrationProps> = ({
  userRole,
  isMobile = false,
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error('Failed to get user session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    getUserId();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading Luna...</div>
      </div>
    );
  }

  // Don't render enhanced chat if no userId available
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Please log in to use Luna</div>
      </div>
    );
  }

  // Use the enhanced Supabase-based Luna chat
  return (
    <SupabaseEnhancedLunaChat 
      userRole={userRole} 
      userId={userId}
      isMobile={isMobile}
    />
  );
}; 