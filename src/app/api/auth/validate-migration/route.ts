import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    console.log('Validating migration token:', token)

    if (!token) {
      return NextResponse.json({ error: 'Migration token required' }, { status: 400 })
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

    // Get migration record with a simpler query approach
    const { data: migration, error } = await supabase
      .from('account_migrations')
      .select('*')
      .eq('migration_token', token)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (error || !migration) {
      console.log('Migration validation failed:', error, 'Migration found:', !!migration)
      return NextResponse.json({ error: 'Invalid or expired migration token' }, { status: 401 })
    }

    console.log('Migration validation successful:', migration.id)

    // Get profile data separately
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        username,
        first_name,
        last_name,
        role,
        organisations (
          id,
          name,
          organisation_type
        )
      `)
      .eq('user_id', migration.user_id)
      .single()

    if (profileError || !profile) {
      console.log('Profile fetch failed:', profileError)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      profile: {
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        organisationType: profile.organisations?.organisation_type,
        organisationName: profile.organisations?.name
      }
    })
  } catch (error) {
    console.error('Migration validation error:', error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
