import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    // First, verify the reset code
    const { data: resetData, error: resetError } = await supabase
      .from('password_reset_codes')
      .select('id, user_id, code, expires_at')
      .eq('code', resetCode)
      .single()

    if (resetError || !resetData) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 })
    }

    // Check if code is expired
    if (new Date(resetData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 })
    }

    // Next, get user profile to verify username
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, organisation_id, organisations:organisation_id (abbr)')
      .eq('user_id', resetData.user_id)
      .single()

    if (profileError || !profileData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify username matches
    if (profileData.username !== username) {
      return NextResponse.json({ error: 'Username does not match reset code' }, { status: 400 })
    }

    // Get organization abbreviation for constructing pseudo-email
    const orgAbbr = profileData.organisations?.abbr

    if (!orgAbbr) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 500 })
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