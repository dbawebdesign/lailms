import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Tables } from 'packages/types/db'

interface SwitchRoleRequest {
  newRole: 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent'
}

export async function POST(request: NextRequest) {
  try {
    const body: SwitchRoleRequest = await request.json()
    
    if (!body.newRole) {
      return NextResponse.json({ error: 'New role is required' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, role, additional_roles, active_role, organisation_id, first_name, last_name')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if user has access to the requested role
    const additionalRoles = Array.isArray(profile.additional_roles) ? profile.additional_roles as string[] : []
    const hasAccess = profile.role === body.newRole || additionalRoles.includes(body.newRole)

    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied', 
        message: 'You do not have permission to switch to this role' 
      }, { status: 403 })
    }

    // Update user's active role
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        active_role: body.newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to switch role', 
        details: updateError.message 
      }, { status: 500 })
    }

    if (!updateData || updateData.length === 0) {
      console.error('No profile updated for user:', user.id)
      return NextResponse.json({ 
        error: 'Failed to update profile', 
        details: 'No rows affected' 
      }, { status: 500 })
    }

    // Get available roles for response
    const availableRoles = [profile.role, ...additionalRoles]
    
    return NextResponse.json({
      success: true,
      currentRole: body.newRole,
      availableRoles,
      message: `Role switched to ${body.newRole}`,
      user: {
        id: user.id,
        name: `${profile.first_name} ${profile.last_name}`,
        organizationId: profile.organisation_id
      }
    })

  } catch (error) {
    console.error('Error switching role:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// GET endpoint to retrieve current role and available roles
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, role, additional_roles, active_role, organisation_id, first_name, last_name')
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Determine current effective role
    const currentRole = profile.active_role || profile.role
    const additionalRoles = Array.isArray(profile.additional_roles) ? profile.additional_roles as string[] : []
    const availableRoles = [profile.role, ...additionalRoles]

    return NextResponse.json({
      currentRole,
      availableRoles,
      hasMultipleRoles: availableRoles.length > 1,
      user: {
        id: user.id,
        name: `${profile.first_name} ${profile.last_name}`,
        organizationId: profile.organisation_id
      }
    })

  } catch (error) {
    console.error('Error getting role info:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 