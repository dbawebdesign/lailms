import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeacherToolLibrary } from "@/components/teach/tools/TeacherToolLibrary";
import { Tables } from "packages/types/db";

import { PROFILE_ROLE_FIELDS, hasTeacherPermissions } from '@/lib/utils/roleUtils';
export default async function TeacherToolLibraryPage() {
  const supabase = createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user profile to verify teacher role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_ROLE_FIELDS + ', organisation_id')
    .eq('user_id', user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    redirect('/');
  }

  // Check if user has teacher permissions (using centralized role checking)
  if (!hasTeacherPermissions(profile)) {
    redirect('/');
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <TeacherToolLibrary />
    </div>
  );
} 