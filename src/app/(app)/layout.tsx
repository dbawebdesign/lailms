import React from 'react';
import AppShell from "@/components/layout/AppShell";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import type { UserRole } from "@/config/navConfig";

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
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile for layout or profile not found:", profileError);
    redirect('/login?error=profile_critical');
  }
  
  // Type assertion for proper access
  const typedProfile = profile as unknown as { role: UserRole };
  userRole = typedProfile.role;

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