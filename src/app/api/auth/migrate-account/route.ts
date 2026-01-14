import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

interface MigrationCheckRequest {
  username: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const body: MigrationCheckRequest = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Initialize admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if this is an old-system user
    // Convert username to lowercase for case-insensitive matching (usernames are stored in lowercase)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        username,
        first_name,
        last_name,
        role,
        organisation_id,
        grade_level,
        organisations!inner (
          id,
          name,
          abbr,
          organisation_type
        )
      `)
      .eq('username', username.toLowerCase())
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if user already has a real email (not @internal)
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id)
    
    if (!authUser?.user?.email?.endsWith('.internal')) {
      // User has a real email - check if they actually went through migration
      // or if they were always an email-based user (e.g., signed up with email directly)
      const { data: migrationRecords } = await supabase
        .from('account_migrations')
        .select('id, status')
        .eq('user_id', profile.user_id)
        .eq('status', 'completed')
        .limit(1)
      
      if (migrationRecords && migrationRecords.length > 0) {
        // User actually went through migration - tell them to use email
        return NextResponse.json({ 
          migrated: true,
          message: 'Account already migrated. Please use email/password or Google login.'
        }, { status: 200 })
      }
      
      // User never went through migration - they signed up with email directly
      // Just return a "no migration needed" response so normal login can proceed
      return NextResponse.json({ 
        needsMigration: false,
        migrated: false 
      }, { status: 200 })
    }

    // Verify password with pseudo-email
    const pseudoEmail = `${username}@${(profile.organisations as any).abbr}.internal`
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: pseudoEmail,
      password
    })

    if (signInError) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create temporary migration token
    const migrationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Store migration session
    console.log('Attempting to create migration session for user:', profile.user_id)
    const migrationData = {
      user_id: profile.user_id,
      migration_token: migrationToken,
      old_username: username,
      organisation_id: profile.organisation_id,
      user_role: profile.role,
      expires_at: expiresAt.toISOString(),
      status: 'pending'
    }
    console.log('Migration data:', migrationData)
    
    const { data: migrationResult, error: migrationError } = await supabase
      .from('account_migrations')
      .insert(migrationData)
      .select()

    if (migrationError) {
      console.error('Migration session error:', migrationError)
      console.error('Migration data that failed:', migrationData)
      return NextResponse.json({ error: 'Failed to initialize migration' }, { status: 500 })
    }
    
    console.log('Migration session created successfully:', migrationResult)

    // Set migration cookie
    const cookieStore = await cookies()
    cookieStore.set('migration_token', migrationToken, {
      httpOnly: false, // Allow client-side access for validation
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 // 30 minutes
    })

    return NextResponse.json({
      needsMigration: true,
      token: migrationToken,
      profile: {
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        organisationType: (profile.organisations as any).organisation_type,
        organisationName: (profile.organisations as any).name
      }
    })
  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json({ error: 'Migration check failed' }, { status: 500 })
  }
}
