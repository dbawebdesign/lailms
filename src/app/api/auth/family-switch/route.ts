import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createSupabaseServerClient()
    
    const { targetUserId } = await request.json()
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Check if switching back to parent account
    if (targetUserId === user.id) {
      // Clear the active family member cookie
      const response = NextResponse.json({
        success: true,
        redirectUrl: '/teach',
        user: {
          id: user.id,
          role: 'teacher'
        }
      })
      
      // Clear the cookie
      response.cookies.delete('active_family_member')
      
      return response
    }
    
    // Get current user's profile to check family relationship
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (!currentProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    // Verify the target user is in the same family
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .single()
    
    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Target profile not found' },
        { status: 404 }
      )
    }
    
    // Check if they're in the same family/organization
    const currentFamilyId = (currentProfile as any).family_id as string | null
    const targetFamilyId = (targetProfile as any).family_id as string | null
    const currentOrgId = (currentProfile as any).organisation_id as string | null
    const targetOrgId = (targetProfile as any).organisation_id as string | null

    const sameFamily = (currentFamilyId && targetFamilyId === currentFamilyId) ||
                      (currentOrgId && targetOrgId === currentOrgId)
    
    if (!sameFamily) {
      return NextResponse.json(
        { error: 'Users are not in the same family' },
        { status: 403 }
      )
    }
    
    // Check if this is a sub-account (student without auth)
    const isSubAccount = targetProfile.is_sub_account === true
    
    if (isSubAccount) {
      // For sub-accounts, we use session/cookie management
      // Set a cookie to track which family member is active
      const response = NextResponse.json({
        success: true,
        redirectUrl: targetProfile.role === 'student' ? '/learn' : '/teach',
        user: {
          id: targetProfile.user_id,
          firstName: targetProfile.first_name,
          lastName: targetProfile.last_name,
          role: targetProfile.role
        }
      })
      
      // Set cookie to track active sub-account
      response.cookies.set('active_family_member', targetUserId, {
        httpOnly: false, // Allow client-side access for family switcher component
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
    } else {
      // For regular accounts (teachers/parents), we might implement actual account switching
      // For now, just redirect based on role
      return NextResponse.json({
        success: true,
        redirectUrl: targetProfile.role === 'student' ? '/learn' : '/teach',
        user: {
          id: targetProfile.user_id,
          firstName: targetProfile.first_name,
          lastName: targetProfile.last_name,
          role: targetProfile.role
        }
      })
    }
  } catch (error) {
    console.error('Family switch error:', error)
    return NextResponse.json(
      { error: 'Failed to switch account' },
      { status: 500 }
    )
  }
}