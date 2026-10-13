import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { code } = await req.json()

    if (typeof code !== 'string' || !code || code.length > 200) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    // Define expected type for invite code data with nested organisation
    type InviteCodeWithOrg = {
        id: string;
        code: string;
        role: string; 
        organisation_id: string; 
        expires_at: string | null;
        organisations: { id: string; name: string; abbr: string; organisation_type: string; settings: any } | null; // Updated to include organisation_type and settings
    }

    // Query the invite code
    const { data, error } = await supabase
      .from('invite_codes')
      .select(`
        id, 
        code, 
        role, 
        organisation_id, 
        expires_at,
        organisations:organisation_id (id, name, abbr, organisation_type, settings)
      `)
      .eq('code', code)
      .single<InviteCodeWithOrg>()


    if (error || !data) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Check if code is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })
    }

    // Return success with code details (excluding sensitive info)
    return NextResponse.json({
      valid: true,
      role: data.role,
      organisation: data.organisations ? {
        id: data.organisations.id,
        name: data.organisations.name,
        type: data.organisations.organisation_type,
        isHomeschoolCoop: data.organisations.organisation_type === 'coop_network',
        isIndividualFamily: data.organisations.organisation_type === 'individual_family',
      } : null,
    })
  } catch (error) {
    console.error('Error verifying invite code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 