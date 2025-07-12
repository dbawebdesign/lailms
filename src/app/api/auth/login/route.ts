import { createServerClient, type CookieOptions } from '@supabase/ssr'
// import { cookies, type ReadonlyRequestCookies } from 'next/headers' // Remove ReadonlyRequestCookies import
import { cookies } from 'next/headers' 
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Remove predefined handlers
  // const cookieStore = cookies() 
  // const cookieHandlers = { ... }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // Create Supabase server client passing functions that call cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // Use async handlers and await cookies()
          async get(name: string) {
            const cookieStore = await cookies()
            return cookieStore.get(name)?.value
          },
          async set(name: string, value: string, options: CookieOptions) {
            const cookieStore = await cookies()
            cookieStore.set({ name, value, ...options })
          },
          async remove(name: string, options: CookieOptions) {
            const cookieStore = await cookies()
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Define the expected type for the profile data including the related organisation
    type ProfileWithOrgAndRole = {
      user_id: string;
      organisation_id: string | null;
      role: string;
      active_role: string | null;
      organisations: { abbr: string } | null;
    }

    // First, get the organization and role from the profile (including active_role for role switching)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        organisation_id,
        role,
        active_role,
        organisations (abbr)
      `)
      .eq('username', username)
      .single<ProfileWithOrgAndRole>()

    if (profileError || !profileData) {
      console.error('Profile fetch error from profiles table:', profileError);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Get organization abbreviation (Type checker should now understand organisations is an object or null)
    const orgAbbr = profileData.organisations?.abbr

    if (!orgAbbr) {
      console.error('Organisation abbreviation not found for profile:', profileData.user_id);
      return NextResponse.json({ error: 'Organization data missing or invalid' }, { status: 500 })
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

    // Calculate effective role (active_role if set, otherwise base role)
    const effectiveRole = profileData.active_role || profileData.role;

    // Return success with user data and effective role
    return NextResponse.json({
      user: data.user,
      session: data.session,
      role: effectiveRole,
    })
  } catch (error) {
    console.error('Error in login API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 