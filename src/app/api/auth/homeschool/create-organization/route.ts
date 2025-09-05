import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Tables } from 'packages/types/db'

type HomeschoolType = 'individual_family' | 'coop_network'

interface CreateHomeschoolOrgRequest {
  organizationType: HomeschoolType
  organizationName: string
  
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
    
    // Enhanced logging for debugging
    console.log('=== HOMESCHOOL SIGNUP DEBUG ===')
    console.log('Request body:', JSON.stringify(body, null, 2))
    console.log('organizationType:', body.organizationType)
    console.log('organizationName:', body.organizationName)
    console.log('primaryContactInfo:', body.primaryContactInfo)
    
    // Validate required fields
    if (!body.organizationType || !body.organizationName || !body.primaryContactInfo) {
      console.log('ERROR: Missing required fields')
      console.log('organizationType present:', !!body.organizationType)
      console.log('organizationName present:', !!body.organizationName)
      console.log('primaryContactInfo present:', !!body.primaryContactInfo)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Validate primaryContactInfo fields
    if (!body.primaryContactInfo.username || !body.primaryContactInfo.firstName || 
        !body.primaryContactInfo.lastName || !body.primaryContactInfo.password) {
      console.log('ERROR: Missing primaryContactInfo fields')
      console.log('username present:', !!body.primaryContactInfo.username)
      console.log('firstName present:', !!body.primaryContactInfo.firstName)
      console.log('lastName present:', !!body.primaryContactInfo.lastName)
      console.log('password present:', !!body.primaryContactInfo.password)
      return NextResponse.json({ error: 'Missing required contact information' }, { status: 400 })
    }

    // Initialize Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Generate a unique abbreviation
    const generateUniqueAbbreviation = async (orgName: string): Promise<string> => {
      // Start with initials from organization name
      const baseAbbr = orgName
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 4) // Limit to 4 characters max for base
      
      // Try different variations until we find a unique one
      for (let attempt = 0; attempt < 100; attempt++) {
        let candidateAbbr: string
        
        if (attempt === 0) {
          // First try: just the base abbreviation
          candidateAbbr = baseAbbr
        } else {
          // Add random suffix for uniqueness
          const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase()
          candidateAbbr = `${baseAbbr}${randomSuffix}`
        }
        
        // Check if this abbreviation already exists
        const { data: existingOrg, error: checkError } = await supabase
          .from('organisations')
          .select('id')
          .eq('abbr', candidateAbbr)
          .single()
        
        if (checkError && checkError.code === 'PGRST116') {
          // PGRST116 means "not found" - this abbreviation is available
          console.log('Generated unique abbreviation:', candidateAbbr)
          return candidateAbbr
        }
        
        if (checkError && checkError.code !== 'PGRST116') {
          // Some other error occurred
          console.log('ERROR: Failed to check abbreviation availability:', checkError)
          throw new Error(`Failed to validate abbreviation: ${checkError.message}`)
        }
        
        // If we get here, the abbreviation exists, so try the next variation
        console.log('Abbreviation already exists, trying next variation:', candidateAbbr)
      }
      
      // If we couldn't find a unique abbreviation after 100 attempts, use timestamp
      const timestamp = Date.now().toString().slice(-4)
      const fallbackAbbr = `${baseAbbr}${timestamp}`
      console.log('Using fallback abbreviation with timestamp:', fallbackAbbr)
      return fallbackAbbr
    }

    const abbreviation = await generateUniqueAbbreviation(body.organizationName)

    // Start transaction-like operations
    let organizationId: string
    let organizationUnitId: string
    let primaryContactId: string

    // 1. Create the organization
    console.log('Creating organization with data:', {
      name: body.organizationName,
      abbr: abbreviation,
      organisation_type: body.organizationType,
      settings: {
        homeschool_type: body.organizationType,
        created_via: 'homeschool_signup'
      }
    })
    
    const { data: newOrg, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name: body.organizationName,
        abbr: abbreviation,
        organisation_type: body.organizationType, // Use the specific type: 'individual_family' or 'coop_network'
        settings: {
          homeschool_type: body.organizationType,
          created_via: 'homeschool_signup'
        }
      })
      .select()
      .single()

    if (orgError || !newOrg) {
      console.log('ERROR: Failed to create organization:', orgError)
      return NextResponse.json({ 
        error: 'Failed to create organization',
        details: orgError?.message || 'Unknown error'
      }, { status: 500 })
    }
    
    console.log('Organization created successfully:', newOrg.id)

    organizationId = newOrg.id

    // 2. Create organization unit
    const isCoop = body.organizationType === 'coop_network';
    const unitName = isCoop 
      ? 'Leadership'
      : (body.familyName || `${body.primaryContactInfo.lastName} Family`);

    const unitType = isCoop ? 'leadership' : 'family';

    const { data: newUnit, error: unitError } = await supabase
      .from('organisation_units')
      .insert({
        organisation_id: organizationId,
        name: unitName,
        unit_type: unitType,
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

    // Determine roles based on organization type
    let primaryRole: 'super_admin' | 'admin' | 'teacher' = 'teacher'
    let additionalRoles: string[] = []

    if (isCoop) {
      primaryRole = 'super_admin'
      additionalRoles = ['admin']
    } else { // individual_family
      primaryRole = 'super_admin'
      additionalRoles = ['admin', 'teacher']
    }

    // Generate a unique pseudo-email
    const generateUniquePseudoEmail = async (baseUsername: string, abbreviation: string): Promise<string> => {
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      // Normalize existing emails to lowercase for case-insensitive comparison
      const existingEmails = new Set(existingUsers.users.map(user => user.email?.toLowerCase()).filter(Boolean))
      
      // Normalize inputs to lowercase
      const normalizedUsername = baseUsername.toLowerCase()
      const normalizedAbbreviation = abbreviation.toLowerCase()
      
      // Try the base email first
      let candidateEmail = `${normalizedUsername}@${normalizedAbbreviation}.internal`
      if (!existingEmails.has(candidateEmail)) {
        return candidateEmail
      }
      
      // If base email exists, try variations
      let counter = 1
      while (counter <= 999) { // Reasonable limit to prevent infinite loops
        candidateEmail = `${normalizedUsername}${counter}@${normalizedAbbreviation}.internal`
        if (!existingEmails.has(candidateEmail)) {
          return candidateEmail
        }
        counter++
      }
      
      // If we still can't find a unique email, try with timestamp
      const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
      candidateEmail = `${normalizedUsername}${timestamp}@${normalizedAbbreviation}.internal`
      if (!existingEmails.has(candidateEmail)) {
        return candidateEmail
      }
      
      // Final fallback with random string
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      return `${normalizedUsername}${randomSuffix}@${normalizedAbbreviation}.internal`
    }

    const pseudoEmail = await generateUniquePseudoEmail(primaryContact.username, abbreviation)
    console.log('Generated unique email:', pseudoEmail)

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
      console.error('Auth user creation error:', authError)
      console.error('Attempted email:', pseudoEmail)
      console.error('Password length:', primaryContact.password.length)
      return NextResponse.json({ 
        error: 'Failed to create primary contact user',
        details: authError?.message || 'Unknown auth error'
      }, { status: 500 })
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
        active_role: 'teacher', // Set active_role to teacher for all non-student users
        additional_roles: additionalRoles,
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      console.error('Profile data:', {
        user_id: primaryContactId,
        username: primaryContact.username,
        first_name: primaryContact.firstName,
        last_name: primaryContact.lastName,
        role: primaryRole,
        additional_roles: additionalRoles,
        organisation_id: organizationId,
        organisation_unit_id: organizationUnitId
      })
      return NextResponse.json({ 
        error: 'Failed to create user profile', 
        details: profileError.message 
      }, { status: 500 })
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
        abbreviation: abbreviation
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