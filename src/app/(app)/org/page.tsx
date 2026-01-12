import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/utils/roleUtils";
import WelcomeCard from "@/components/dashboard/WelcomeCard"; 
import HomeschoolCoopDashboard from "@/components/dashboard/HomeschoolCoopDashboard";
import HomeschoolDashboard from "@/components/dashboard/HomeschoolDashboard";
import { Tables } from "packages/types/db";
import { getEffectiveRole, isSuperAdmin, PROFILE_ROLE_FIELDS } from "@/lib/utils/roleUtils";

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Auth error or no user:', authError);
    redirect("/login?error=auth");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_ROLE_FIELDS + ", first_name, last_name, user_id, organisation_id")
    .eq("user_id", user.id)
    .single<Tables<"profiles">>();

  if (profileError || !profile) {
    console.error("Error fetching super admin profile or profile not found:", profileError);
    redirect("/login?error=profile");
  }

  // Check if user has super admin access
  const hasSuperAdminAccess = isSuperAdmin(profile);

  if (!hasSuperAdminAccess) {
    const currentRole = getEffectiveRole(profile);
    console.warn(`User with role ${currentRole} accessed super admin dashboard. Redirecting.`);
    redirect("/dashboard?error=unauthorized"); 
  }

  // Get organization information
  if (!profile.organisation_id) {
    console.error("User has no organization assigned");
    redirect("/login?error=no_organization");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organisations")
    .select("id, name, organisation_type, abbr")
    .eq("id", profile.organisation_id)
    .single();

  if (orgError || !organization) {
    console.error("Error fetching organization:", orgError);
    redirect("/login?error=organization");
  }
  
  const userName = profile.first_name || user.email || "Super Administrator";
  const currentRole = getEffectiveRole(profile) || 'student'; // fallback

  // Render different dashboards based on organization type
  if (organization.organisation_type === 'coop_network') {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <WelcomeCard userName={userName} userRole={currentRole as UserRole} />
        <HomeschoolCoopDashboard 
          organizationId={organization.id}
          organizationName={organization.name}
          userRole={currentRole}
        />
      </div>
    );
  } else if (organization.organisation_type === 'individual_family') {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <WelcomeCard userName={userName} userRole={currentRole as UserRole} />
        <HomeschoolDashboard 
          organizationId={organization.id}
          organizationName={organization.name}
          userRole={currentRole}
        />
      </div>
    );
  }

  // Fallback for other organization types
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
          <p className="text-muted-foreground">System status, alerts, and notifications will appear here.</p>
        </div>
      </div>
    </div>
  );
} 