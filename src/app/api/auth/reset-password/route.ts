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
      .from('password_reset_requests')
      .select('*')
      .eq('reset_token', resetCode)
      .eq('email', username)
      .gt('expires_at', new Date().toISOString())
      .is('fulfilled_at', null) // Make sure it hasn't been used yet
      .single();

    if (resetError || !resetData) {
      return NextResponse.json({ error: 'Invalid or expired reset code' }, { status: 400 })
    }

    // Check if code is expired
    if (new Date(resetData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 })
    }

    // Create admin client for changing password
    const adminAuthClient = supabase.auth.admin

    // Find the user by email to get the user ID
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      return NextResponse.json({ error: 'Failed to find user' }, { status: 500 })
    }

    const user = userData.users.find(u => u.email === resetData.email);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user password
    const { error: updateError } = await adminAuthClient.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    // Mark reset code as used
    await supabase
      .from('password_reset_requests')
      .update({ fulfilled_at: new Date().toISOString() })
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