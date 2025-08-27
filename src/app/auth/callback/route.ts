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
          organisations (
            organisation_type
          )
        `)
        .eq('user_id', data.user.id)
        .single()

      if (profile) {
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
      }
      
      // If no profile found, redirect to signup
      return NextResponse.redirect(`${origin}/homeschool-signup`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
