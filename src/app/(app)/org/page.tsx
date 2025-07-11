import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/config/navConfig";
import WelcomeCard from "@/components/dashboard/WelcomeCard"; 
import { Tables } from "packages/types/db";

export default async function SuperAdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user:', authError);
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active_role, additional_roles, first_name, last_name, user_id")
    .eq("user_id", user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    console.error("Error fetching super admin profile or profile not found:", profileError);
    redirect("/login?error=profile");
  }

  // Get current effective role (considering role switching)
  const currentRole = profile.active_role || profile.role;
  const additionalRoles = Array.isArray(profile.additional_roles) ? profile.additional_roles as string[] : [];
  const hasSuperAdminAccess = currentRole === 'super_admin' || profile.role === 'super_admin' || additionalRoles.includes('super_admin');

  if (!hasSuperAdminAccess) {
    console.warn(`User with role ${currentRole} accessed super admin dashboard. Redirecting.`);
    redirect("/dashboard?error=unauthorized"); 
  }
  
  const userName = profile.first_name || user.email || "Super Administrator";

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <WelcomeCard userName={userName} userRole={currentRole as UserRole} />
      {/* <h1 className="text-3xl font-bold mb-6">Welcome, {userName}! (Super Admin Dashboard - /org)</h1> */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder for "Organization-Wide KPIs" */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-2">
          <h2 className="text-xl font-semibold mb-3">Organization-Wide KPIs</h2>
          <p className="text-muted-foreground">Key Performance Indicators (total institutions, users, platform usage, billing status) will appear here.</p>
        </div>

        {/* Placeholder for "Core Management Modules" */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-xl font-semibold mb-3">Core Management Modules</h2>
          <p className="text-muted-foreground">Quick links to: Manage Institutions, Billing & Usage, Global Platform Settings.</p>
        </div>

        {/* Placeholder for "Platform Health & Alerts" */}
        <div className="bg-card p-6 rounded-lg shadow lg:col-span-3">
          <h2 className="text-xl font-semibold mb-3">Platform Health & Alerts</h2>
          <p className="text-muted-foreground">Critical system notifications or alerts.</p>
        </div>
      </div>
    </div>
  );
} 