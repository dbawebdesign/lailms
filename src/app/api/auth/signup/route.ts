import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Tables } from 'packages/types/db'

// Define expected type for invite code data with nested organisation
type InviteCodeWithOrg = {
  id: string;
  code: string;
  role: string; 
  organisation_id: string;
  expires_at: string | null;
  organisations: { id: string; name: string; abbr: string } | null; // Expect single object or null
}

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const data = await req.json()
    console.log('Signup request data:', data);
    
    // Use exactly the same property names used in the frontend
    const { inviteCode, username, password, firstName, lastName, gradeLevel } = data

    // Basic validation
    if (!inviteCode || !username || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if invite code exists and is valid - using the exact code parameter name
    console.log('Looking up invite code:', inviteCode);
    const { data: inviteData, error: inviteError } = await supabase
      .from('invite_codes')
      .select(`
        id, 
        code, 
        role, 
        organisation_id, 
        expires_at,
        organisations:organisation_id (id, name, abbr)
      `)
      .eq('code', inviteCode) // This should match the code we're sending
      .single<InviteCodeWithOrg>()

    console.log('Invite code lookup result:', { inviteData, inviteError });

    if (inviteError || !inviteData) {
      console.log('Invite code validation failed - code not found');
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Check if code is expired
    if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
      console.log('Invite code validation failed - expired');
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })
    }

    if (!inviteData.organisations) {
      console.log('Invite code validation failed - organisation not found');
      return NextResponse.json({ error: 'Organisation not found' }, { status: 400 })
    }

    // Check if username is already taken
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .limit(1)
      .returns<Tables<"profiles">[]>()

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
    }

    // Create a pseudo-email for authentication
    const pseudoEmail = `${username}@${inviteData.organisations.abbr}.internal`

    // Create the user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: pseudoEmail,
      password: password,
      email_confirm: true, // Skip email verification
      user_metadata: {
        role: inviteData.role,
        organisation_id: inviteData.organisation_id,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
      },
    })

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Error creating user', details: authError },
        { status: 500 }
      )
    }

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        username: username,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
        role: inviteData.role,
        organisation_id: inviteData.organisation_id,
      })

    if (profileError) {
      // Attempt to rollback auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      
      return NextResponse.json(
        { error: 'Error creating profile', details: profileError },
        { status: 500 }
      )
    }

    // Return success with user data including email for payment redirect
    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: authUser.user.id,
        username: username,
        email: pseudoEmail,
        role: inviteData.role,
        organisation_id: inviteData.organisation_id,
        requiresPayment: true, // Flag to indicate payment is needed
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error in signup API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 