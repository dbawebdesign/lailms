import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import HomeschoolDashboardClient from "@/components/dashboard/HomeschoolDashboardClient"

// Force dynamic rendering for auth-protected pages
export const dynamic = 'force-dynamic';

export default async function HomeschoolDashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  console.log('Homeschool page - Profile data:', profile)
  console.log('Homeschool page - Profile error:', profileError)

  if (profileError || !profile) {
    console.error('Profile not found or error:', profileError)
    redirect("/homeschool-signup")
  }

  // Local narrows for fields recently added in Supabase schema
  const isPrimaryParent = (profile as any).is_primary_parent as boolean | null
  const familyId = (profile as any).family_id as string | null

  // Check if user has an organization - required for homeschool dashboard
  if (!profile.organisation_id) {
    console.error('User has no organization ID, redirecting to signup')
    redirect("/homeschool-signup")
  }

  // Load organisation details to verify homeschool type
  let organisationName = 'My Homeschool'
  if (profile.organisation_id) {
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, organisation_type')
      .eq('id', profile.organisation_id)
      .single()

    if (org?.name) organisationName = org.name
    // Check if this is actually a homeschool organization
    if (org?.organisation_type !== 'individual_family' && org?.organisation_type !== 'homeschool_coop') {
      console.log('Not a homeschool organization, redirecting to appropriate dashboard')
      redirect("/teach") // Redirect non-homeschool teachers to regular teacher dashboard
    }
  }

  // Check if payment is complete - if user hasn't paid, redirect to payment
  if (!profile.paid) {
    console.log('User has not paid, redirecting to payment')
    redirect("/payment")
  }

  // Get family students if this is a parent account
  let students: { id: string; firstName: string; lastName: string; gradeLevel: string; username: string }[] = []
  if (isPrimaryParent && familyId) {
    // First get students from profiles table by family_id
    const { data: profileStudents } = await (supabase as any)
      .from('profiles')
      .select('user_id, first_name, last_name, grade_level, username')
      .eq('family_id', familyId)
      .eq('role', 'student')
      .order('first_name')

    if (profileStudents) {
      students = profileStudents.map((student: any) => ({
        id: student.user_id,
        firstName: student.first_name || '',
        lastName: student.last_name || '',
        gradeLevel: student.grade_level || '',
        username: student.username || ''
      }))
    }

    // Also get students from family_students table
    const { data: familyStudents } = await (supabase as any)
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
      .eq('family_id', familyId)

    type FamilyStudentRow = {
      student_id: string
      profiles?: {
        user_id?: string
        first_name?: string | null
        last_name?: string | null
        grade_level?: string | null
        username?: string | null
      } | null
    }

    const familyStudentRows: FamilyStudentRow[] = (familyStudents as FamilyStudentRow[] | null) ?? []
    
    // Merge family_students data, avoiding duplicates
    familyStudentRows.forEach((fs: FamilyStudentRow) => {
      if (fs.profiles && !students.find(s => s.id === fs.student_id)) {
        students.push({
          id: fs.student_id,
          firstName: fs.profiles.first_name || '',
          lastName: fs.profiles.last_name || '',
          gradeLevel: fs.profiles.grade_level || '',
          username: fs.profiles.username || ''
        })
      }
    })
  }

  // Get active courses (normalize description to undefined for client prop)
  let courses: { id: string; name: string; description?: string; class_instances?: any[] }[] = []
  if (profile.organisation_id) {
    const { data } = await (supabase as any)
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
    const rows: { id: string; name: string; description: string | null; class_instances?: any[] }[] = data || []
    courses = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      class_instances: r.class_instances
    }))
  }

  return (
    <HomeschoolDashboardClient
      userName={profile.first_name || 'Teacher'}
      organizationName={organisationName}
      organizationId={profile.organisation_id!}
      students={students}
      courses={courses || []}
      isFirstTime={!courses || courses.length === 0}
    />
  )
}
