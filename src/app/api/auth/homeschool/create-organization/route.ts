import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Tables } from 'packages/types/db'

type HomeschoolType = 'individual_family' | 'coop_network'

interface CreateHomeschoolOrgRequest {
  organizationType: HomeschoolType
  organizationName: string
  abbreviation: string
  
  // For individual families
  familyName?: string
  
  // For coop networks
  coopLeaderInfo?: {
    username: string
    firstName: string
    lastName: string
    password: string
  }
  
  // For both
  primaryContactInfo: {
    username: string
    firstName: string
    lastName: string
    password: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateHomeschoolOrgRequest = await request.json()
    
    // Validate required fields
    if (!body.organizationType || !body.organizationName || !body.abbreviation || !body.primaryContactInfo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Initialize Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if abbreviation is already taken
    const { data: existingOrg } = await supabase
      .from('organisations')
      .select('id')
      .eq('abbr', body.abbreviation)
      .single()

    if (existingOrg) {
      return NextResponse.json({ error: 'Organization abbreviation already exists' }, { status: 400 })
    }

    // Start transaction-like operations
    let organizationId: string
    let organizationUnitId: string
    let primaryContactId: string

    // 1. Create the organization
    const { data: newOrg, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name: body.organizationName,
        abbr: body.abbreviation,
        organisation_type: body.organizationType, // Use the specific type: 'individual_family' or 'coop_network'
        settings: {
          homeschool_type: body.organizationType,
          created_via: 'homeschool_signup'
        }
      })
      .select()
      .single()

    if (orgError || !newOrg) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    organizationId = newOrg.id

    // 2. Create organization unit
    const unitName = body.organizationType === 'individual_family' 
      ? (body.familyName || `${body.primaryContactInfo.lastName} Family`)
      : 'Leadership'

    const { data: newUnit, error: unitError } = await supabase
      .from('organisation_units')
      .insert({
        organisation_id: organizationId,
        name: unitName,
        unit_type: body.organizationType === 'individual_family' ? 'family' : 'leadership',
        settings: {
          homeschool_type: body.organizationType
        }
      })
      .select()
      .single()

    if (unitError || !newUnit) {
      return NextResponse.json({ error: 'Failed to create organization unit' }, { status: 500 })
    }

    organizationUnitId = newUnit.id

    // 3. Create primary contact user
    const primaryContact = body.primaryContactInfo
    const pseudoEmail = `${primaryContact.username}@${body.abbreviation}.internal`

    // Determine roles based on organization type
    let primaryRole: 'super_admin' | 'admin' | 'teacher' = 'teacher'
    let additionalRoles: string[] = []

    if (body.organizationType === 'individual_family') {
      primaryRole = 'super_admin'
      additionalRoles = ['admin', 'teacher']
    } else {
      primaryRole = 'super_admin'
      additionalRoles = ['admin']
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pseudoEmail,
      password: primaryContact.password,
      email_confirm: true,
      user_metadata: {
        role: primaryRole,
        organisation_id: organizationId,
        first_name: primaryContact.firstName,
        last_name: primaryContact.lastName,
        homeschool_type: body.organizationType
      }
    })

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Failed to create primary contact user' }, { status: 500 })
    }

    primaryContactId = authUser.user.id

    // 4. Create profile for primary contact
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: primaryContactId,
        username: primaryContact.username,
        first_name: primaryContact.firstName,
        last_name: primaryContact.lastName,
        role: primaryRole,
        additional_roles: additionalRoles,
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId
      })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    // 5. Create family info record (if individual family)
    if (body.organizationType === 'individual_family') {
      const { error: familyError } = await supabase
        .from('homeschool_family_info')
        .insert({
          organisation_id: organizationId,
          organisation_unit_id: organizationUnitId,
          family_name: body.familyName || `${primaryContact.lastName} Family`,
          primary_parent_id: primaryContactId,
          settings: {
            setup_completed: false,
            needs_student_setup: true
          }
        })

      if (familyError) {
        return NextResponse.json({ error: 'Failed to create family info' }, { status: 500 })
      }
    }

    // 6. Create storage bucket for the organization
    const bucketName = `org-${organizationId}-uploads`
    const { error: bucketError } = await supabase.storage.createBucket(
      bucketName,
      { 
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50 MB limit
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/csv',
          'text/plain',
          'audio/mpeg',
          'audio/wav',
          'video/mp4',
          'image/jpeg',
          'image/png',
          'image/webp'
        ]
      }
    )

    // Don't fail if bucket creation fails - it can be created later
    if (bucketError) {
      console.warn('Storage bucket creation failed:', bucketError)
    }

    // 7. Get the auto-generated invite codes
    const { data: inviteCodes, error: inviteError } = await supabase
      .from('invite_codes')
      .select('code, role')
      .eq('organisation_id', organizationId)

    if (inviteError) {
      console.warn('Failed to fetch invite codes:', inviteError)
    }

    // Return success response
    return NextResponse.json({
      success: true,
      organization: {
        id: organizationId,
        name: body.organizationName,
        type: body.organizationType,
        abbreviation: body.abbreviation
      },
      primaryContact: {
        id: primaryContactId,
        username: primaryContact.username,
        email: pseudoEmail,
        roles: [primaryRole, ...additionalRoles]
      },
      organizationUnit: {
        id: organizationUnitId,
        name: unitName,
        type: body.organizationType === 'individual_family' ? 'family' : 'leadership'
      },
      inviteCodes: inviteCodes || [],
      nextSteps: body.organizationType === 'individual_family' 
        ? ['setup_students', 'configure_curriculum']
        : ['invite_families', 'setup_structure']
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating homeschool organization:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 