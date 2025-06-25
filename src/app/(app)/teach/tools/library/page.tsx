import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeacherToolLibrary } from "@/components/teach/tools/TeacherToolLibrary";

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
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'teacher') {
    redirect('/');
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <TeacherToolLibrary />
    </div>
  );
} 