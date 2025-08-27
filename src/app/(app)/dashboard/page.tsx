import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image';
import { getActiveProfile } from '@/lib/auth/family-helpers';
import { getEffectiveRole } from '@/lib/utils/roleUtils';

export default async function DashboardPage() {
  // Get the active profile (handles both regular users and sub-accounts)
  const activeProfileData = await getActiveProfile();
  
  if (!activeProfileData) {
    redirect('/login')
  }
  
  const { profile, isSubAccount } = activeProfileData;
  
  // Get organization info if needed
  const supabase = createSupabaseServerClient()
  const { data: orgData } = await supabase
    .from('organisations')
    .select('organisation_type')
    .eq('id', profile.organisation_id)
    .single()
  
  const userRole = getEffectiveRole(profile)?.toLowerCase()
  const orgType = orgData?.organisation_type
    
    // Redirect homeschool users to their dedicated dashboard
    if (orgType === 'individual_family' || orgType === 'homeschool_coop') {
      if (userRole === 'teacher') {
        console.log('Dashboard: Redirecting teacher to /teach')
        redirect('/teach')
      } else if (userRole === 'student') {
        redirect('/learn')
      }
    }
    
    // Redirect other roles to their appropriate dashboards
    switch (userRole) {
      case 'student':
        redirect('/learn')
      case 'teacher':
        redirect('/teach')
      case 'admin':
        redirect('/school')
      case 'super_admin':
        redirect('/org')
    }
  }

  // Fallback: Show coming soon page for unrecognized cases
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Image
        src="/Horizontal white text.png"
        alt="Learnology AI"
        width={240}
        height={60}
        className="h-16 w-auto mb-8"
      />
      <h1 className="text-3xl font-bold text-center text-foreground mb-4">Parent Dashboard Coming Soon</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        We're working hard to bring you a dedicated dashboard for parents. Stay tuned for updates!
      </p>
    </div>
  );
} 