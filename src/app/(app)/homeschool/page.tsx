import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import HomeschoolDashboardClient from "@/components/dashboard/HomeschoolDashboardClient"

export default async function HomeschoolDashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Get user profile and organization info
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      *,
      organisations (
        id,
        name,
        organisation_type,
        max_students,
        subscription_status
      ),
      homeschool_family_info!profiles_family_id_fkey (
        id,
        family_name
      )
    `)
    .eq('user_id', user.id)
    .single()

  console.log('Homeschool page - Profile data:', profile)
  console.log('Homeschool page - Profile error:', profileError)

  if (profileError || !profile) {
    console.error('Profile not found or error:', profileError)
    redirect("/homeschool-signup")
  }

  // Check if this is actually a homeschool organization
  if (profile.organisations?.organisation_type !== 'individual_family' && profile.organisations?.organisation_type !== 'homeschool_coop') {
    console.log('Not a homeschool organization, redirecting to appropriate dashboard')
    redirect("/teach") // Redirect non-homeschool teachers to regular teacher dashboard
  }

  // Check if payment is complete - if user hasn't paid, redirect to payment
  if (!profile.paid) {
    console.log('User has not paid, redirecting to payment')
    redirect("/payment")
  }

  // Get family students if this is a parent account
  let students = []
  if (profile.is_primary_parent && profile.family_id) {
    const { data: familyStudents } = await supabase
      .from('family_students')
      .select(`
        student_id,
        profiles!family_students_student_id_fkey (
          user_id,
          first_name,
          last_name,
          grade_level,
          username
        )
      `)
      .eq('family_id', profile.family_id)

    students = familyStudents?.map(fs => ({
      id: fs.student_id,
      firstName: fs.profiles?.first_name || '',
      lastName: fs.profiles?.last_name || '',
      gradeLevel: fs.profiles?.grade_level || '',
      username: fs.profiles?.username || ''
    })) || []
  }

  // Get active courses
  const { data: courses } = await supabase
    .from('base_classes')
    .select(`
      id,
      name,
      description,
      class_instances (
        id,
        name,
        status
      )
    `)
    .eq('user_id', user.id)
    .eq('organisation_id', profile.organisation_id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <HomeschoolDashboardClient
      userName={profile.first_name || 'Teacher'}
      organizationName={profile.organisations?.name || 'My Homeschool'}
      students={students}
      courses={courses || []}
      isFirstTime={!courses || courses.length === 0}
    />
  )
}
