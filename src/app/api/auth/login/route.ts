import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers' 
import { NextRequest, NextResponse } from 'next/server'

// Define the expected type for the profile data including the related organisation
type ProfileWithOrgAndRole = {
  user_id: string;
  organisation_id: string | null;
  role: string;
  active_role: string | null;
  organisations: { abbr: string; organisation_type: string } | null;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    
    // Accept either 'username' or 'identifier' for backwards compatibility
    const identifier = username

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Username/email and password are required' }, { status: 400 })
    }

    // Create Supabase server client for session management
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
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

    // Check if identifier is an email (contains @)
    const isEmail = identifier.includes('@')
    
    console.log('Login API: Identifier:', identifier, 'isEmail:', isEmail);

    // If it's an email, try direct email login first (for homeschool/email signups)
    if (isEmail) {
      console.log('Login API: Attempting direct email login');
      
      // Try to sign in directly with email
      const { data: emailAuthData, error: emailAuthError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      })

      if (!emailAuthError && emailAuthData?.user) {
        console.log('Login API: Email login successful for user:', emailAuthData.user.id);
        
        // Get profile data for the authenticated user
        const { data: profileData } = await supabase
          .from('profiles')
          .select(`
            user_id,
            organisation_id,
            role,
            active_role,
            organisations (abbr, organisation_type)
          `)
          .eq('user_id', emailAuthData.user.id)
          .single<ProfileWithOrgAndRole>()

        // Calculate effective role
        const effectiveRole = profileData?.active_role || profileData?.role || 'teacher';

        return NextResponse.json({
          user: emailAuthData.user,
          session: emailAuthData.session,
          role: effectiveRole,
          organisation_type: profileData?.organisations?.organisation_type,
        })
      }
      
      console.log('Login API: Direct email login failed:', emailAuthError?.message);
      // If direct email login fails, return error (don't fall through to username logic)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Username login flow (existing logic for invite code users)
    console.log('Login API: Looking up profile for username:', identifier);
    
    // Get the organization and role from the profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        organisation_id,
        role,
        active_role,
        organisations (abbr, organisation_type)
      `)
      .eq('username', identifier)
      .single<ProfileWithOrgAndRole>()
      
    console.log('Login API: Profile lookup result:', profileData);
    console.log('Login API: Profile lookup error:', profileError);

    if (profileError || !profileData) {
      console.error('Profile fetch error from profiles table:', profileError);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Get organization abbreviation
    const orgAbbr = profileData.organisations?.abbr

    // Always get the user's actual auth email from auth.users
    // This handles both email-signup users and legacy .internal users
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: authUserData } = await adminSupabase.auth.admin.getUserById(profileData.user_id)
    const authEmail = authUserData?.user?.email || null
    
    console.log('Login API: Got auth email from admin:', authEmail);

    // Determine the email to use for authentication
    // Prefer the actual auth email, fall back to .internal pseudo-email only if needed
    const loginEmail = authEmail || (orgAbbr ? `${identifier}@${orgAbbr}.internal` : null)
    
    if (!loginEmail) {
      console.error('Could not determine login email for user:', profileData.user_id);
      return NextResponse.json({ error: 'Account configuration error. Please contact support.' }, { status: 500 })
    }

    console.log('Login API: Using login email:', loginEmail);

    // Sign in with the determined email
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })
    
    console.log('Login API: Auth result user ID:', data?.user?.id);
    console.log('Login API: Auth error:', error);

    if (error) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Calculate effective role
    const effectiveRole = profileData.active_role || profileData.role;

    // Return success with user data
    return NextResponse.json({
      user: data.user,
      session: data.session,
      role: effectiveRole,
      organisation_type: profileData.organisations?.organisation_type,
    })
  } catch (error) {
    console.error('Error in login API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 