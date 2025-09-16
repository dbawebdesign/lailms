import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createSupabaseServerClient()
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Get user profile to determine redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          role,
          active_role,
          onboarding_completed,
          onboarding_step,
          organisations (
            organisation_type
          )
        `)
        .eq('user_id', data.user.id)
        .single()

      if (profile) {
        // Check if this is a new user who just confirmed their email
        if (!profile.onboarding_completed) {
          // New user - redirect to onboarding flow
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
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: data.user.email?.split('@')[0] || 'user', // Default username from email
            role: 'teacher', // Default to teacher for homeschool users
            active_role: 'teacher', // Set active_role to teacher for homeschool users
            onboarding_completed: false,
            onboarding_step: 'organization_type'
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
