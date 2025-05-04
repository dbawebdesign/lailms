import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { username } = await req.json()

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
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

    // Check if user exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, organisation_id')
      .eq('username', username)
      .single()

    if (profileError || !profileData) {
      // Don't reveal whether the user exists or not for security reasons
      return NextResponse.json({ 
        message: 'If this username exists, a reset code has been sent to the administrator' 
      })
    }

    // Generate a reset code using the database function
    const { data: resetData, error: resetError } = await supabase
      .rpc('generate_password_reset_code', { username })

    if (resetError) {
      console.error('Error generating reset code:', resetError)
      return NextResponse.json({ error: 'Failed to generate reset code' }, { status: 500 })
    }

    // In a real application, you might want to notify an admin or teacher
    // For now, we'll just return success (the code is in the database)
    
    return NextResponse.json({
      message: 'Reset code generated successfully',
      // In production, don't return the actual code in the response
      // This is just for demonstration purposes
      resetCode: process.env.NODE_ENV === 'development' ? resetData : undefined,
    })
  } catch (error) {
    console.error('Error in password reset request API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 