import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // Create Supabase server client
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // First, get the organization from the profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        organisation_id,
        organisations:organisation_id (abbr)
      `)
      .eq('username', username)
      .single()

    if (profileError || !profileData) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Get organization abbreviation for constructing pseudo-email
    const orgAbbr = profileData.organisations?.abbr

    if (!orgAbbr) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 500 })
    }

    // Construct pseudo-email
    const pseudoEmail = `${username}@${orgAbbr}.internal`

    // Sign in with pseudo-email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pseudoEmail,
      password,
    })

    if (error) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Return success with user data
    return NextResponse.json({
      user: data.user,
      session: data.session,
    })
  } catch (error) {
    console.error('Error in login API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 