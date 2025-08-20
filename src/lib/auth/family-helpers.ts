import { cookies } from 'next/headers'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

/**
 * Get the currently active profile, considering family member switching
 * Returns the actual profile that should be used for the current request
 */
export async function getActiveProfile() {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient()
  const supabaseAdmin = createSupabaseServiceClient()
  
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
      console.log('Found sub-account profile:', subProfile)
      return {
        profile: subProfile,
        isSubAccount: true,
        parentId: subProfile.parent_account_id
      }
    }
  }
  
  // Otherwise, get the regular authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return null
  }
  
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
export function clearActiveFamilyMember() {
  const cookieStore = cookies()
  cookieStore.delete('active_family_member')
}
