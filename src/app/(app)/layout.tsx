import React from 'react';
import AppShell from "@/components/layout/AppShell";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";
import { AskLunaProvider } from "@/context/AskLunaContext";
import { SurveyIntegration } from "@/components/onboarding/SurveyIntegration";
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

  console.log('Layout: Authenticated user ID:', user.id);
  console.log('Layout: User email:', user.email);

  let userRole: UserRole | null = null;
  
  // Try to fetch profile with a retry mechanism for better reliability
  let profile: Tables<'profiles'> | null = null;
  let profileError: any = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    console.log(`Layout: Profile fetch attempt ${attempt + 1} for user_id: ${user.id}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select(`${PROFILE_ROLE_FIELDS}, survey_completed, organisation_id, organisations(organisation_type)`)
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();
    
    if (error) {
      profileError = error;
      console.error(`Profile fetch attempt ${attempt + 1} failed:`, error);
      console.error(`Query was: SELECT ${PROFILE_ROLE_FIELDS} FROM profiles WHERE user_id = '${user.id}'`);
      
      // Wait a bit before retrying (except on last attempt)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      profile = data;
      profileError = null;
      console.log(`Layout: Profile fetch successful on attempt ${attempt + 1}:`, data);
      break;
    }
  }

  if (profileError || !profile) {
    console.error("Error fetching profile for layout or profile not found after retries:", profileError);
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
        <AskLunaProvider>
          <AppShell userRole={userRole}>
            {children}
            <SurveyIntegration userRole={userRole} profile={profile} />
          </AppShell>
        </AskLunaProvider>
      </LunaContextRegistration>
    </UIContextProvider>
  );
} 