import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Tables } from 'packages/types/db'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { username, resetCode, newPassword } = await req.json()

    if (!username || !resetCode || !newPassword) {
      return NextResponse.json(
        { error: 'Username, reset code, and new password are required' },
        { status: 400 }
      )
    }

    // Create Supabase server client with async handlers
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

    // First, verify the reset code
    const { data: resetData, error: resetError } = await supabase
      .from('password_reset_codes')
      .select('id, user_id, code, expires_at')
      .eq('code', resetCode)
      .single<Tables<'password_reset_codes'>>()

    if (resetError || !resetData) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 })
    }

    // Check if code is expired
    if (new Date(resetData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 })
    }

    // Define the expected type for the profile data
    type ProfileWithOrg = {
      user_id: string;
      username: string;
      organisation_id: string;
      organisations: { abbr: string } | null; // Expect single object or null
    }

    // Next, get user profile to verify username
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, organisation_id, organisations:organisation_id (abbr)')
      .eq('user_id', resetData.user_id)
      .single<ProfileWithOrg>() // Apply the type assertion

    if (profileError || !profileData) {
      // Handle profile fetch error
      console.error('Profile fetch error for reset:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Verify username matches
    if (profileData.username !== username) {
      return NextResponse.json({ error: 'Username does not match reset code' }, { status: 400 })
    }

    // Get organization abbreviation (Type checker should now work)
    const orgAbbr = profileData.organisations?.abbr

    if (!orgAbbr) {
      // Handle missing org abbr
      console.error('Organisation abbreviation not found for user:', profileData.user_id);
      return NextResponse.json({ error: 'Organization data missing or invalid' }, { status: 500 })
    }

    // Construct pseudo-email
    const pseudoEmail = `${username}@${orgAbbr}.internal`

    // Create admin client for changing password
    const adminAuthClient = supabase.auth.admin

    // Update user password
    const { error: updateError } = await adminAuthClient.updateUserById(
      profileData.user_id,
      { password: newPassword }
    )

    if (updateError) {
      return NextResponse.json(
        { error: 'Error updating password', details: updateError.message },
        { status: 500 }
      )
    }

    // Mark reset code as used
    await supabase
      .from('password_reset_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetData.id)

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    })
  } catch (error) {
    console.error('Error in password reset API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 