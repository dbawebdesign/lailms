import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const supabaseAdmin = createSupabaseServiceClient() // Use service client for admin operations
    const body = await request.json()
    const { action, data } = body

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    switch (action) {
      case 'create_family': {
        const { familyName, firstName, lastName } = data

        // Create organization
        const { data: org, error: orgError } = await supabase
          .from('organisations')
          .insert({
            name: familyName,
            organisation_type: 'individual_family',
            max_students: 4,
            subscription_status: 'pending'
          })
          .select()
          .single()

        if (orgError) {
          return NextResponse.json(
            { error: 'Failed to create organization' },
            { status: 500 }
          )
        }

        // Create organization unit
        const { data: orgUnit, error: unitError } = await supabase
          .from('organisation_units')
          .insert({
            organisation_id: org.id,
            name: familyName,
            unit_type: 'family'
          })
          .select()
          .single()

        if (unitError) {
          return NextResponse.json(
            { error: 'Failed to create organization unit' },
            { status: 500 }
          )
        }

        // Create homeschool family info
        const { data: familyInfo, error: familyError } = await supabase
          .from('homeschool_family_info')
          .insert({
            organisation_id: org.id,
            organisation_unit_id: orgUnit.id,
            family_name: familyName,
            primary_parent_id: user.id
          })
          .select()
          .single()

        if (familyError) {
          return NextResponse.json(
            { error: 'Failed to create family info' },
            { status: 500 }
          )
        }

        // Update user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            organisation_id: org.id,
            organisation_unit_id: orgUnit.id,
            family_id: familyInfo.id,
            role: 'teacher',
            is_primary_parent: true,
            onboarding_step: 'add_students'
          })
          .eq('user_id', user.id)

        if (profileError) {
          return NextResponse.json(
            { error: 'Failed to update profile' },
            { status: 500 }
          )
        }

        // Generate student invite code
        const inviteCode = `${familyName.toLowerCase().replace(/\s+/g, '-')}-student-${Math.random().toString(36).substr(2, 9)}`
        await supabase
          .from('invite_codes')
          .insert({
            code: inviteCode,
            organisation_id: org.id,
            role: 'student',
            created_by: user.id,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          })

        return NextResponse.json({
          success: true,
          organizationId: org.id,
          familyId: familyInfo.id,
          inviteCode
        })
      }

      case 'add_students': {
        const { students, familyId, organizationId } = data

        // Get the organization unit ID
        const { data: orgUnit } = await supabase
          .from('organisation_units')
          .select('id')
          .eq('organisation_id', organizationId)
          .single()

        if (!orgUnit) {
          return NextResponse.json(
            { error: 'Organization unit not found' },
            { status: 404 }
          )
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
          const { data: studentAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: studentEmail,
            password: Math.random().toString(36).substr(2, 32) + 'Aa1!',
            email_confirm: true,
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
            continue
          }

          if (!studentAuth?.user) {
            console.error('No user returned for student:', student.firstName)
            continue
          }

          const studentId = studentAuth.user.id
          console.log('Created shadow auth with ID:', studentId)
          
          // Create student profile linked to the shadow auth account
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: studentId, // Using the auth user ID
              first_name: student.firstName,
              last_name: '', // Students may not have last names
              grade_level: student.gradeLevel,
              role: 'student',
              active_role: 'student',
              organisation_id: organizationId,
              organisation_unit_id: orgUnit.id, // Use the correct unit ID
              family_id: familyId,
              paid: true, // Inherit from parent's payment
              onboarding_completed: true,
              is_sub_account: true, // Flag to indicate this is a sub-account
              parent_account_id: user.id, // Link to parent account
              additional_roles: JSON.stringify(['student'])
            })
            .select()
            .single()

          if (profileError) {
            console.error('Error creating student profile:', profileError)
            console.error('Profile data attempted:', {
              user_id: studentId,
              first_name: student.firstName,
              grade_level: student.gradeLevel,
              organisation_id: organizationId,
              organisation_unit_id: orgUnit.id,
              family_id: familyId
            })
            // Clean up the auth account if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(studentId)
            continue
          }

          console.log('Created student profile:', profileData)

          // Link student to family
          const { error: linkError } = await supabase
            .from('family_students')
            .insert({
              family_id: familyId,
              student_id: studentId,
              created_by: user.id
            })

          if (linkError) {
            console.error('Error linking student to family:', linkError)
            // Continue anyway - the student profile exists
          }

          createdStudents.push({
            id: studentId,
            firstName: student.firstName,
            gradeLevel: student.gradeLevel
          })
          
          console.log('Successfully created student:', student.firstName)
        }

        // Update onboarding step
        await supabase
          .from('profiles')
          .update({ 
            onboarding_step: 'payment',
            onboarding_completed: false 
          })
          .eq('user_id', user.id)

        return NextResponse.json({
          success: true,
          students: createdStudents
        })
      }

      case 'complete_onboarding': {
        // Mark onboarding as complete
        const { error } = await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            onboarding_step: 'complete'
          })
          .eq('user_id', user.id)

        if (error) {
          return NextResponse.json(
            { error: 'Failed to complete onboarding' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true })
      }

      case 'create_coop': {
        const { coopName, firstName, lastName, estimatedFamilies } = data

        // Create co-op organization
        const { data: org, error: orgError } = await supabase
          .from('organisations')
          .insert({
            name: coopName,
            organisation_type: 'coop_network',
            settings: {
              estimated_families: estimatedFamilies
            }
          })
          .select()
          .single()

        if (orgError) {
          return NextResponse.json(
            { error: 'Failed to create co-op' },
            { status: 500 }
          )
        }

        // Update user profile as co-op admin
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            organisation_id: org.id,
            role: 'admin',
            is_primary_parent: true,
            onboarding_step: 'payment'
          })
          .eq('user_id', user.id)

        if (profileError) {
          return NextResponse.json(
            { error: 'Failed to update profile' },
            { status: 500 }
          )
        }

        // Generate admin invite code for other families
        const adminCode = `${coopName.toLowerCase().replace(/\s+/g, '-')}-admin-${Math.random().toString(36).substr(2, 9)}`
        await supabase
          .from('invite_codes')
          .insert({
            code: adminCode,
            organisation_id: org.id,
            role: 'admin',
            created_by: user.id,
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
          })

        return NextResponse.json({
          success: true,
          organizationId: org.id,
          inviteCode: adminCode
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Homeschool setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
