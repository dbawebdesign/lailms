import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Tables } from 'packages/types/db'

interface CoopFamilySignupRequest {
  inviteCode: string
  familyName: string
  primaryParentInfo: {
    username: string
    firstName: string
    lastName: string
    password: string
  }
}

interface InviteCodeWithOrg {
  id: string
  code: string
  role: string
  organisation_id: string
  expires_at: string | null
  organisations: {
    id: string
    name: string
    abbr: string
    organisation_type: string
    settings: any
  } | null
}

export async function POST(request: NextRequest) {
  try {
    const body: CoopFamilySignupRequest = await request.json()
    
    // Validate required fields
    if (!body.inviteCode || !body.familyName || !body.primaryParentInfo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { inviteCode, familyName, primaryParentInfo } = body

    // Initialize Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify invite code and get organization info
    const { data: inviteData, error: inviteError } = await supabase
      .from('invite_codes')
      .select(`
        id, 
        code, 
        role, 
        organisation_id, 
        expires_at,
        organisations:organisation_id (id, name, abbr, organisation_type, settings)
      `)
      .eq('code', inviteCode)
      .single<InviteCodeWithOrg>()

    if (inviteError || !inviteData) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Check if code is expired
    if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })
    }

    // Verify this is a co-op organization and admin role
    if (!inviteData.organisations || inviteData.organisations.organisation_type !== 'coop_network') {
      return NextResponse.json({ error: 'This invite code is not for a homeschool co-op' }, { status: 400 })
    }

    if (inviteData.role !== 'admin') {
      return NextResponse.json({ error: 'Invalid invite code role for family signup' }, { status: 400 })
    }

    // Check if username is already taken
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', primaryParentInfo.username)
      .limit(1)

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
    }

    const organizationId = inviteData.organisation_id
    const organizationAbbr = inviteData.organisations.abbr

    // Create organization unit for the family
    const { data: newUnit, error: unitError } = await supabase
      .from('organisation_units')
      .insert({
        organisation_id: organizationId,
        name: familyName,
        unit_type: 'family',
        settings: {
          homeschool_type: 'coop_family',
          parent_organization: organizationId
        }
      })
      .select()
      .single()

    if (unitError || !newUnit) {
      return NextResponse.json({ error: 'Failed to create family unit' }, { status: 500 })
    }

    const organizationUnitId = newUnit.id

    // Create primary parent user
    const pseudoEmail = `${primaryParentInfo.username}@${organizationAbbr}.internal`

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pseudoEmail,
      password: primaryParentInfo.password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId,
        first_name: primaryParentInfo.firstName,
        last_name: primaryParentInfo.lastName,
        homeschool_type: 'coop_family'
      }
    })

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Failed to create parent user' }, { status: 500 })
    }

    const parentUserId = authUser.user.id

    // Create profile for primary parent
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: parentUserId,
        username: primaryParentInfo.username,
        first_name: primaryParentInfo.firstName,
        last_name: primaryParentInfo.lastName,
        role: 'admin',
        additional_roles: ['teacher', 'parent'],
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId
      })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create parent profile' }, { status: 500 })
    }

    // Create family info record
    const { error: familyError } = await supabase
      .from('homeschool_family_info')
      .insert({
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId,
        family_name: familyName,
        primary_parent_id: parentUserId,
        settings: {
          setup_completed: false,
          needs_student_setup: true,
          parent_organization_id: organizationId,
          is_coop_family: true
        }
      })

    if (familyError) {
      return NextResponse.json({ error: 'Failed to create family info' }, { status: 500 })
    }

    // Mark the admin invite code as used
    await supabase
      .from('invite_codes')
      .update({ 
        used_at: new Date().toISOString(),
        used_by_user_id: parentUserId 
      })
      .eq('id', inviteData.id)

    // Get the student invite code for this co-op organization
    const { data: studentCodes } = await supabase
      .from('invite_codes')
      .select('code, role')
      .eq('organisation_id', organizationId)
      .eq('role', 'student')
      .is('organisation_unit_id', null)
      .is('used_at', null)
      .limit(1)

    return NextResponse.json({
      success: true,
      family: {
        id: organizationUnitId,
        name: familyName,
        organization_id: organizationId,
        organization_name: inviteData.organisations.name
      },
      primaryParent: {
        id: parentUserId,
        username: primaryParentInfo.username,
        email: pseudoEmail,
        roles: ['admin', 'teacher', 'parent']
      },
      inviteCodes: studentCodes || [],
      nextSteps: [
        'setup_students',
        'explore_courses',
        'connect_with_coop'
      ]
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating co-op family:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 