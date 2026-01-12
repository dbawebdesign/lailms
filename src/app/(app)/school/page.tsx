import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeschoolCoopDashboard from '@/components/dashboard/HomeschoolCoopDashboard'
import HomeschoolFamilyAdminDashboard from '@/components/dashboard/HomeschoolFamilyAdminDashboard'

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

export default async function SchoolPage() {
  const supabase = createSupabaseServerClient()

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }

  // Get user profile with organization information
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      *,
      organisations (
        id,
        name,
        organisation_type
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile || !profile.organisations) {
    redirect('/login')
  }

  // Determine which dashboard to show based on organization type and user role
  const orgType = profile.organisations.organisation_type
  const userRole = profile.role

  // Coop leaders: super_admin role in coop_network organization
  if (orgType === 'coop_network' && userRole === 'super_admin') {
    return (
      <HomeschoolCoopDashboard 
        organizationId={profile.organisations.id}
        organizationName={profile.organisations.name}
        userRole={userRole}
      />
    )
  }

  // Family admins: admin role in either coop_network or individual_family organization
  if (userRole === 'admin' && (orgType === 'coop_network' || orgType === 'individual_family')) {
    return (
      <HomeschoolFamilyAdminDashboard />
    )
  }

  // Default: Traditional school dashboard for all other cases
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">School Administration</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Students</h2>
          <p className="text-gray-600">Manage student enrollment and records</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Teachers</h2>
          <p className="text-gray-600">Manage teaching staff and assignments</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Courses</h2>
          <p className="text-gray-600">Manage curriculum and course offerings</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Reports</h2>
          <p className="text-gray-600">View academic and administrative reports</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <p className="text-gray-600">Configure school settings and policies</p>
        </div>
      </div>
    </div>
  )
} 