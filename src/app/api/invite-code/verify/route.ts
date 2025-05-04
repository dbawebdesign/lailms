import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    // Create Supabase server client
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Query the invite code
    const { data, error } = await supabase
      .from('invite_codes')
      .select(`
        id, 
        code, 
        role, 
        organisation_id, 
        is_redeemed, 
        expires_at,
        organisations:organisation_id (id, name, abbr)
      `)
      .eq('code', code)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }

    // Check if code is already redeemed
    if (data.is_redeemed) {
      return NextResponse.json({ error: 'Invite code has already been used' }, { status: 400 })
    }

    // Check if code is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })
    }

    // Return success with code details (excluding sensitive info)
    return NextResponse.json({
      valid: true,
      role: data.role,
      organisation: {
        id: data.organisations?.id,
        name: data.organisations?.name,
      },
    })
  } catch (error) {
    console.error('Error verifying invite code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 