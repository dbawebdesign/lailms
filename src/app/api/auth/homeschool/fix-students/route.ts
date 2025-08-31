import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createSupabaseServerClient()
    const supabaseAdmin = createSupabaseServiceClient() // Use service client for admin operations
    
    const { students } = await request.json()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Get user's profile and organization info
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
    
    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    const organizationId = profile.organisation_id
    const organizationUnitId = profile.organisation_unit_id // Get the actual unit ID
    const familyId = profile.family_id
    
    if (!organizationId || !familyId) {
      return NextResponse.json(
        { error: 'Organization or family not found' },
        { status: 400 }
      )
    }
    
    // If no organization unit ID, try to find or create one
    let unitId = organizationUnitId
    if (!unitId) {
      // Check if there's an existing unit for this organization
      const { data: existingUnit } = await supabase
        .from('organisation_units')
        .select('id')
        .eq('organisation_id', organizationId)
        .single()
      
      if (existingUnit) {
        unitId = existingUnit.id
      } else {
        // Create a default unit if none exists
        const { data: newUnit, error: unitError } = await supabase
          .from('organisation_units')
          .insert({
            organisation_id: organizationId,
            name: profile.organisations?.name || 'Main Unit',
            unit_type: 'main'
          })
          .select()
          .single()
        
        if (unitError || !newUnit) {
          console.error('Error creating organization unit:', unitError)
          return NextResponse.json(
            { error: 'Failed to create organization unit' },
            { status: 500 }
          )
        }
        unitId = newUnit.id
      }
    }
    
    const createdStudents = []
    
    for (const student of students) {
      // Create a "shadow" auth account for the student
      // This maintains foreign key integrity but prevents direct login
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substr(2, 6)
      const studentEmail = `${student.firstName.toLowerCase()}.${familyId}.${timestamp}@student.internal`
      
      console.log('Creating shadow auth account for student:', studentEmail)
      
      // Create auth user with a random password using service role
      // This creates the auth record but with unusable credentials
      const { data: studentAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: studentEmail,
        password: Math.random().toString(36).substr(2, 32) + 'Aa1!', // Random password they'll never use
        email_confirm: true, // Auto-confirm since they won't receive emails
        user_metadata: {
          first_name: student.firstName,
          grade_level: student.gradeLevel,
          role: 'student',
          is_sub_account: true,
          parent_id: user.id
        }
      })
      
      if (authError) {
        console.error('Error creating student auth:', authError)
        return NextResponse.json(
          { error: `Failed to create auth for ${student.firstName}: ${authError.message}` },
          { status: 500 }
        )
      }
      
      if (!studentAuth?.user) {
        return NextResponse.json(
          { error: `No user returned for ${student.firstName}` },
          { status: 500 }
        )
      }
      
      const studentId = studentAuth.user.id
      console.log('Created shadow auth account with ID:', studentId)
      
      // Create student profile linked to the shadow auth account
      const profilePayload = {
        user_id: studentId, // Using the auth user ID
        first_name: student.firstName,
        last_name: '',
        grade_level: student.gradeLevel,
        role: 'student',
        active_role: 'student',
        organisation_id: organizationId,
        organisation_unit_id: unitId, // Use the correct unit ID
        family_id: familyId,
        paid: true, // Inherits from parent's payment
        onboarding_completed: true,
        is_sub_account: true, // Flag to indicate this is a sub-account
        parent_account_id: user.id, // Link to parent account
        additional_roles: JSON.stringify(['student'])
      }
      
      console.log('Profile payload:', profilePayload)
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert(profilePayload)
        .select()
        .single()
      
      if (profileError) {
        console.error('Error creating student profile:', profileError)
        // Clean up the auth account if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(studentId)
        return NextResponse.json(
          { error: `Failed to create profile for ${student.firstName}: ${profileError.message}` },
          { status: 500 }
        )
      }
      
      console.log('Created profile:', profileData)
      
      // Link student to family
      const { error: linkError } = await supabase
        .from('family_students')
        .insert({
          family_id: familyId,
          student_id: studentId,
          created_by: user.id
        })
      
      if (linkError) {
        console.error('Warning: Error linking student to family:', linkError)
        // Don't fail - student profile exists
      }
      
      createdStudents.push({
        id: studentId,
        firstName: student.firstName,
        gradeLevel: student.gradeLevel
      })
    }
    
    return NextResponse.json({
      success: true,
      students: createdStudents,
      message: 'Students created successfully!'
    })
  } catch (error) {
    console.error('Fix students error:', error)
    return NextResponse.json(
      { error: 'Failed to create students' },
      { status: 500 }
    )
  }
}