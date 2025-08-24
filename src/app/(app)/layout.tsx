import React from 'react';
import AppShell from "@/components/layout/AppShell";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";
import { AskLunaProvider } from "@/context/AskLunaContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import type { UserRole } from "@/lib/utils/roleUtils";
import { Tables } from 'packages/types/db';
import { PROFILE_ROLE_FIELDS, getEffectiveRole } from "@/lib/utils/roleUtils";
import AdminMessageModal from "@/components/messaging/AdminMessageModal";
import { getActiveProfile } from '@/lib/auth/family-helpers';

export default async function AppPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the active profile (handles both regular users and sub-accounts)
  const activeProfileData = await getActiveProfile();
  
  if (!activeProfileData) {
    console.error('No active profile found in layout');
    redirect('/login?error=auth');
  }
  
  const { profile, isSubAccount, parentId } = activeProfileData;
  
  console.log('Layout: Active profile:', {
    userId: profile.user_id,
    firstName: profile.first_name,
    role: profile.role,
    isSubAccount,
    parentId
  });
  
  // Get the effective role for this profile
  const userRole = getEffectiveRole(profile);

  if (!userRole) {
    console.error("User role could not be determined in layout, redirecting to login.");
    redirect('/login?error=role_missing');
  }

  return (
    <UIContextProvider>
      <LunaContextRegistration>
        <AskLunaProvider>
          <AppShell userRole={userRole}>
            {children}
            <AdminMessageModal />
          </AppShell>
        </AskLunaProvider>
      </LunaContextRegistration>
    </UIContextProvider>
  );
} 