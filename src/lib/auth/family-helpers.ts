import { cookies } from 'next/headers'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

/**
 * Get the currently active profile, considering family member switching
 * Returns the actual profile that should be used for the current request
 */
export async function getActiveProfile() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient()
  const supabaseAdmin = createSupabaseServiceClient()
  
  // Get the current authenticated user first
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return null
  }

  // First check if there's an active family member cookie (for sub-accounts)
  const activeMemberId = cookieStore.get('active_family_member')?.value
  
  if (activeMemberId) {
    console.log('Active family member detected:', activeMemberId)
    
    // Fetch the sub-account profile using admin client
    const { data: subProfile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', activeMemberId)
      .single()
    
    if (subProfile && !error) {
      // SAFEGUARD: Verify the sub-account belongs to the current authenticated user's family
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('family_id, organisation_id')
        .eq('user_id', user.id)
        .single()
      
      if (currentProfile) {
        const sameFamily = ((currentProfile as any).family_id && (subProfile as any).family_id === (currentProfile as any).family_id) ||
                          ((currentProfile as any).organisation_id && (subProfile as any).organisation_id === (currentProfile as any).organisation_id)
        
        if (sameFamily) {
          console.log('Found valid sub-account profile:', subProfile)
          return {
            profile: subProfile,
            isSubAccount: true,
            parentId: (subProfile as any).parent_account_id
          }
        } else {
          console.warn('Sub-account does not belong to current user family, clearing cookie')
          // Clear the invalid cookie
          cookieStore.delete('active_family_member')
        }
      }
    }
  }
  
  // Get the regular authenticated user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (profileError || !profile) {
    return null
  }
  
  return {
    profile,
    isSubAccount: false,
    parentId: null
  }
}

/**
 * Clear the active family member cookie
 */
export async function clearActiveFamilyMember() {
  const cookieStore = await cookies()
  cookieStore.delete('active_family_member')
}
