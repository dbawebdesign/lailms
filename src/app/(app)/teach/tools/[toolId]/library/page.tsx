import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TeacherToolLibrary } from "@/components/teach/tools/TeacherToolLibrary";
import { teachingTools } from "@/config/teachingTools";
import { Tables } from "packages/types/db";

import { PROFILE_ROLE_FIELDS, hasTeacherPermissions } from '@/lib/utils/roleUtils';
interface ToolLibraryPageProps {
  params: Promise<{
    toolId: string;
  }>;
}

export default async function ToolLibraryPage({ params }: ToolLibraryPageProps) {
  const { toolId } = await params;
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

  // Verify tool exists
  const tool = teachingTools.find(t => t.id === toolId);
  if (!tool) {
    redirect('/teach/tools');
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          {tool.name} Library
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Your saved {tool.name.toLowerCase()} creations
        </p>
      </div>
      
      <TeacherToolLibrary initialToolId={toolId} />
    </div>
  );
} 