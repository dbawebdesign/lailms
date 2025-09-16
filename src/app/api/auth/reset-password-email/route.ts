import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // For your system, we need to convert username to email format
    // First, let's check if this is a username and convert it to pseudo-email
    let emailToUse = email
    
    // Check if it's a username (no @ symbol)
    if (!email.includes('@')) {
      // Look up the user's profile to get organization info
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          username,
          organisation_id,
          organisations (abbr)
        `)
        .eq('username', email)
        .single()

      if (profileError || !profileData) {
        // Don't reveal whether the user exists or not for security reasons
        return NextResponse.json({
          message: 'If this account exists, a password reset email has been sent.'
        })
      }

      // Get organization abbreviation
      const orgAbbr = (profileData.organisations as any)?.abbr
      if (!orgAbbr) {
        return NextResponse.json(
          { error: 'Organization data missing' },
          { status: 500 }
        )
      }

      // Construct pseudo-email
      emailToUse = `${email}@${orgAbbr}.internal`
    }

    // Send password reset email using Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/change-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
      // Don't reveal the specific error to prevent user enumeration
      return NextResponse.json({
        message: 'If this account exists, a password reset email has been sent.'
      })
    }

    return NextResponse.json({
      message: 'If this account exists, a password reset email has been sent.'
    })
  } catch (error) {
    console.error('Error in password reset API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
