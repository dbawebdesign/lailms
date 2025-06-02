import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ToolLibrary } from "@/components/teach/tools/ToolLibrary";

export default async function TeacherToolsPage() {
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Teacher Tools
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          AI-powered tools to streamline your teaching workflow and enhance student learning
        </p>
      </header>

      <ToolLibrary />
    </div>
  );
} 