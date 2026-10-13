import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { ensureBootstrapProfile } from '@/lib/auth/bootstrap-profile'
import { randomBytes } from 'crypto'
import type { FamilyProvisioningProfile } from '@/lib/auth/family-access'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const supabaseAdmin = createSupabaseServiceClient() // Use service client for admin operations
    const body = await request.json()
    const { action, data = {} } = body

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { error: bootstrapError } = await ensureBootstrapProfile(user)
    if (bootstrapError) return NextResponse.json({ error: 'Failed to initialize profile' }, { status: 500 })
    const { data: parent, error: parentError } = await supabase
      .from('profiles').select('*').eq('user_id', user.id).single<FamilyProvisioningProfile>()
    if (parentError || !parent) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    if (parent.is_sub_account || parent.role === 'student') {
      return NextResponse.json({ error: 'Student accounts cannot provision families' }, { status: 403 })
    }
    if (['create_family', 'create_coop', 'join_coop'].includes(action) && parent.organisation_id) {
      return NextResponse.json({ error: 'This account already belongs to an organization' }, { status: 409 })
    }
    if (['create_family', 'create_coop', 'join_coop'].includes(action)
        && !['firstName', 'lastName'].every(key => typeof data[key] === 'string' && data[key].trim().length > 0 && data[key].length <= 50)) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    switch (action) {
      case 'create_family': {
        const { familyName, firstName, lastName } = data
        if (typeof familyName !== 'string' || !familyName.trim() || familyName.length > 100) {
          return NextResponse.json({ error: 'Family name is required' }, { status: 400 })
        }

        // Create organization
        const { data: org, error: orgError } = await supabaseAdmin
          .from('organisations')
          .insert({
            name: familyName,
            abbr: `F_${randomBytes(6).toString('hex')}`,
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
        const { data: orgUnit, error: unitError } = await supabaseAdmin
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
        const { data: familyInfo, error: familyError } = await supabaseAdmin
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
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            organisation_id: org.id,
            organisation_unit_id: orgUnit.id,
            family_id: familyInfo.id,
            role: 'teacher',
            active_role: 'teacher',
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
        await supabaseAdmin
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
        const { students } = data
        const familyId = parent.family_id
        const organizationId = parent.organisation_id
        if (!parent.is_primary_parent || !familyId || !organizationId
            || (data.familyId && data.familyId !== familyId)
            || (data.organizationId && data.organizationId !== organizationId)) {
          return NextResponse.json({ error: 'You cannot add students to this family' }, { status: 403 })
        }
        if (!Array.isArray(students) || students.length === 0 || students.length > 4
            || students.some(s => typeof s.firstName !== 'string' || !s.firstName.trim() || s.firstName.length > 50
              || typeof s.gradeLevel !== 'string' || s.gradeLevel.length > 20)) {
          return NextResponse.json({ error: 'Provide one to four valid students' }, { status: 400 })
        }

        // Get the organization unit ID
        const { data: orgUnit } = await supabaseAdmin
          .from('organisation_units')
          .select('id')
          .eq('id', parent.organisation_unit_id!)
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
            password: randomBytes(32).toString('base64url') + 'Aa1!',
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
          const { data: profileData, error: profileError } = await (supabaseAdmin as any)
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
              paid: parent.paid === true,
              onboarding_completed: true,
              is_sub_account: true, // Flag to indicate this is a sub-account
              parent_account_id: user.id, // Link to parent account
              additional_roles: ['student']
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
          const { error: linkError } = await (supabase as any)
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
        await (supabase as any)
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
        const { error } = await (supabase as any)
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
        if (typeof coopName !== 'string' || !coopName.trim() || coopName.length > 100) {
          return NextResponse.json({ error: 'Co-op name is required' }, { status: 400 })
        }

        // Create co-op organization
        const { data: org, error: orgError } = await supabaseAdmin
          .from('organisations')
          .insert({
            name: coopName,
            abbr: `C_${randomBytes(6).toString('hex')}`,
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
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            organisation_id: org.id,
            role: 'admin',
            active_role: 'teacher',
            additional_roles: ['teacher'],
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
        await supabaseAdmin
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

      case 'join_coop': {
        const { joinCode, firstName, lastName } = data
        if (typeof joinCode !== 'string' || !joinCode || joinCode.length > 200) {
          return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
        }
        const { data: invite, error: inviteError } = await supabaseAdmin.from('invite_codes')
          .select('organisation_id, role, expires_at, organisations(organisation_type)')
          .eq('code', joinCode).single()
        if (inviteError || !invite || !['admin', 'teacher', 'parent'].includes(invite.role)
            || (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())
            || (invite.organisations as any)?.organisation_type !== 'coop_network') {
          return NextResponse.json({ error: 'Invalid or expired co-op invite code' }, { status: 400 })
        }
        // The invite chooses the organisation. Body-supplied IDs or roles are never used.
        const familyName = `${lastName.trim()} Family`
        const { data: unit, error: unitError } = await supabaseAdmin.from('organisation_units')
          .insert({ organisation_id: invite.organisation_id, name: familyName, unit_type: 'family' })
          .select('id').single()
        if (unitError || !unit) return NextResponse.json({ error: 'Could not create family unit' }, { status: 500 })
        const { data: family, error: familyError } = await supabaseAdmin.from('homeschool_family_info')
          .insert({ organisation_id: invite.organisation_id, organisation_unit_id: unit.id,
            family_name: familyName, primary_parent_id: user.id }).select('id').single()
        if (familyError || !family) return NextResponse.json({ error: 'Could not create family' }, { status: 500 })
        const { error } = await supabaseAdmin.from('profiles').update({
          first_name: firstName, last_name: lastName, organisation_id: invite.organisation_id,
          organisation_unit_id: unit.id, family_id: family.id, role: 'teacher', active_role: 'teacher',
          is_primary_parent: true, onboarding_completed: false, onboarding_step: 'add_students',
        }).eq('user_id', user.id)
        if (error) return NextResponse.json({ error: 'Could not join co-op' }, { status: 500 })
        return NextResponse.json({ success: true, organizationId: invite.organisation_id, familyId: family.id })
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
