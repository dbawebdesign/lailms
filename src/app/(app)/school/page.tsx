import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/utils/roleUtils";
import WelcomeCard from "@/components/dashboard/WelcomeCard";
import { Tables } from "packages/types/db";
import { getEffectiveRole, isAdmin, PROFILE_ROLE_FIELDS } from "@/lib/utils/roleUtils";

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user:', authError);
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_ROLE_FIELDS + ", first_name, last_name, user_id")
    .eq("user_id", user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    console.error("Error fetching admin profile or profile not found:", profileError);
    redirect("/login?error=profile");
  }

  // Check if user has admin access
  const hasAdminAccess = isAdmin(profile);

  if (!hasAdminAccess) {
    const currentRole = getEffectiveRole(profile);
    console.warn(`User with role ${currentRole} accessed admin (/school) dashboard. Redirecting.`);
    redirect("/dashboard?error=unauthorized"); 
  }
  
  const userName = profile.first_name || user.email || "Administrator";
  const currentRole = getEffectiveRole(profile);

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <WelcomeCard userName={userName} userRole={currentRole as UserRole} />
      <h1 className="text-3xl font-bold mb-6">Welcome, {userName}! (Admin Dashboard - /school)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder for "School/Department At-a-Glance" KPIs */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-xl font-semibold mb-3">School/Department At-a-Glance</h2>
          <p className="text-muted-foreground">Key Performance Indicators (total users, course stats, engagement trends) will appear here.</p>
        </div>

        {/* Placeholder for "Key Administrative Links" */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-xl font-semibold mb-3">Key Administrative Links</h2>
          <p className="text-muted-foreground">Quick links to: Manage Users & Roles, Oversee Courses, View School Analytics.</p>
        </div>

        {/* Placeholder for "System Updates / Pending Approvals" */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-3">
          <h2 className="text-xl font-semibold mb-3">System Updates & Approvals</h2>
          <p className="text-muted-foreground">Notifications about new user approvals, pending reviews, etc.</p>
        </div>
      </div>
    </div>
  );
} 