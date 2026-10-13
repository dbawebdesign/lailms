import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Tables } from 'packages/types/db'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { username } = await req.json()

    if (typeof username !== 'string' || username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // Check if user exists
    // Convert username to lowercase for case-insensitive matching (usernames are stored in lowercase)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, organisation_id')
      .eq('username', username.toLowerCase())
      .single<Tables<'profiles'>>()

    if (profileError || !profileData) {
      // Don't reveal whether the user exists or not for security reasons
      return NextResponse.json({ 
        message: 'If this username exists, a reset code has been sent to the administrator' 
      })
    }

    // Generate a reset code using the database function
    const { data: resetData, error: resetError } = await supabase
      .rpc('generate_password_reset_code', { username: username.toLowerCase() })

    if (resetError) {
      console.error('Error generating reset code:', resetError)
      return NextResponse.json({ error: 'Failed to generate reset code' }, { status: 500 })
    }

    // In a real application, you might want to notify an admin or teacher
    // For now, we'll just return success (the code is in the database)
    
    return NextResponse.json({
      message: 'If this username exists, a reset code has been sent to the administrator'
    })
  } catch (error) {
    console.error('Error in password reset request API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 