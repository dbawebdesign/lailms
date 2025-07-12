import React from 'react';
import AppShell from "@/components/layout/AppShell";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import type { UserRole } from "@/lib/utils/roleUtils";
import { Tables } from 'packages/types/db';
import { PROFILE_ROLE_FIELDS } from "@/lib/utils/roleUtils";

export default async function AppPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user in layout:', authError);
    redirect('/login?error=auth');
  }

  let userRole: UserRole | null = null;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_ROLE_FIELDS)
    .eq('user_id', user.id)
    .single<Tables<'profiles'>>();

  if (profileError || !profile) {
    console.error("Error fetching profile for layout or profile not found:", profileError);
    redirect('/login?error=profile_critical');
  }
  
  // Use current effective role (considering role switching)
  userRole = profile.active_role || profile.role;

  if (!userRole) {
    console.error("User role could not be determined in layout, redirecting to login.");
    redirect('/login?error=role_missing');
  }

  return (
    <UIContextProvider>
      <LunaContextRegistration>
        <AppShell userRole={userRole}>{children}</AppShell>
      </LunaContextRegistration>
    </UIContextProvider>
  );
} 