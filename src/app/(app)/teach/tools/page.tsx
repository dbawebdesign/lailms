import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ToolLibrary } from "@/components/teach/tools/ToolLibrary";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Tables } from "packages/types/db";

import { PROFILE_ROLE_FIELDS, hasTeacherPermissions } from '@/lib/utils/roleUtils';
export default async function TeacherToolsPage() {
  const supabase = createSupabaseServerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user profile to verify teacher role (check active role for role switching)
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
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
              Teacher Tools
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              AI-powered tools to streamline your teaching workflow and enhance student learning
            </p>
          </div>
          <Link href="/teach/tools/library">
            <Button variant="outline" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              My Library
            </Button>
          </Link>
        </div>
      </header>

      <ToolLibrary />
    </div>
  );
} 