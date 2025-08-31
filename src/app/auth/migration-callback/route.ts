import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const migrationToken = searchParams.get('migration_token')

  if (code) {
    const supabase = createSupabaseServerClient()
    
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Pass migration token to complete-google-migration page
      const redirectUrl = migrationToken 
        ? `${origin}/complete-google-migration?migration_token=${migrationToken}`
        : `${origin}/complete-google-migration`
      
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Error handling
  return NextResponse.redirect(`${origin}/login?error=migration_failed`)
}
