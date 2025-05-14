import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/config/navConfig";

const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  student: "/learn",
  teacher: "/teach",
  admin: "/school",
  super_admin: "/org",
  parent: "/dashboard",
};

export default async function RootPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || !profile.role) {
    console.error("RootPage: Profile error or role missing for user:", user.id, profileError);
    return redirect("/login?error=profile_role_missing_at_root");
  }

  const userRole = profile.role.toLowerCase() as UserRole;
  const dashboardPath = ROLE_DASHBOARD_MAP[userRole];

  if (dashboardPath) {
    return redirect(dashboardPath);
  } else {
    console.warn("RootPage: Unmapped role '" + userRole + "' for user: " + user.id + ". Redirecting to /dashboard.");
    return redirect("/dashboard?error=unrecognized_role_at_root");
  }
}
