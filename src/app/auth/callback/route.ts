import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const supabase = createSupabaseServerClient()

  // Handle PKCE flow with token_hash (for password reset)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error && data.user) {
      // For password reset, redirect to change password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/change-password`)
      }
      
      // For email confirmation, continue with normal flow
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // If there's an error, redirect to error page
    return NextResponse.redirect(`${origin}/login?error=invalid_token`)
  }

  // Handle standard OAuth code exchange
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Get user profile to determine redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          role,
          active_role,
          organisations (
            organisation_type
          )
        `)
        .eq('user_id', data.user.id)
        .single()

      if (profile) {
        // Check if this is a homeschool user (no organization or individual_family type)
        const isHomeschoolUser = !profile.organisations || 
          profile.organisations.organisation_type === 'individual_family' ||
          profile.organisations.organisation_type === 'homeschool_coop'
        
        // If it's a homeschool user, redirect to onboarding to complete setup
        if (isHomeschoolUser && !profile.organisations) {
          // New homeschool user - redirect to onboarding flow
          return NextResponse.redirect(`${origin}/homeschool-signup`)
        }

        // Existing user - redirect to their appropriate dashboard
        const userRole = (profile.active_role || profile.role)?.toUpperCase()
        const orgType = profile.organisations?.organisation_type
        
        let redirectPath = '/dashboard' // Default
        
        switch (userRole) {
          case 'STUDENT':
            redirectPath = '/learn'
            break
          case 'TEACHER':
            // All teachers go to /teach regardless of organization type
            redirectPath = '/teach'
            break
          case 'ADMIN':
            redirectPath = '/school'
            break
          case 'SUPER_ADMIN':
            redirectPath = '/org'
            break
        }
        
        return NextResponse.redirect(`${origin}${redirectPath}`)
      } else {
        // No profile found - this is a new user who just confirmed their email
        // Create initial profile for homeschool users
        // Get username from user metadata (set during signup) or fallback to email prefix
        const usernameFromMetadata = data.user.user_metadata?.username
        const fallbackUsername = data.user.email?.split('@')[0] || 'user'
        const username = usernameFromMetadata || fallbackUsername

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: username,
            role: 'teacher', // Default to teacher for homeschool users
            active_role: 'teacher' // Set active_role to teacher for homeschool users
          })

        if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
          console.error('Profile creation error:', profileError)
        }

        // Track referral signup with FirstPromoter
        try {
          await fetch(`${origin}/api/firstpromoter/track-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: data.user.email,
              uid: data.user.id 
            }),
          });
        } catch (fpError) {
          // Don't fail signup if FirstPromoter tracking fails
          console.warn('FirstPromoter tracking failed:', fpError);
        }

        // Redirect to homeschool signup flow
        return NextResponse.redirect(`${origin}/homeschool-signup`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
