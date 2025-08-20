import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user profile to check organization type
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      role,
      active_role,
      organisations (
        organisation_type
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (profile) {
    const userRole = (profile.active_role || profile.role)?.toLowerCase()
    const orgType = profile.organisations?.organisation_type
    
    // Redirect homeschool users to their dedicated dashboard
    if (orgType === 'individual_family' || orgType === 'homeschool_coop') {
      if (userRole === 'teacher') {
        console.log('Dashboard: Redirecting homeschool teacher to /homeschool')
        redirect('/homeschool')
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