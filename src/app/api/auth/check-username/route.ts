import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json()

    // Basic validation
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Validate username format
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' }, { status: 400 })
    }

    if (!/^[a-zA-Z]/.test(username)) {
      return NextResponse.json({ error: 'Username must start with a letter' }, { status: 400 })
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if username exists in profiles table
    // Convert username to lowercase for case-insensitive matching (usernames are stored in lowercase)
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username.toLowerCase())
      .limit(1)

    if (checkError) {
      console.error('Username check error:', checkError)
      return NextResponse.json({ error: 'Failed to check username availability' }, { status: 500 })
    }

    const available = !existingUser || existingUser.length === 0

    return NextResponse.json({ 
      available,
      username: username.toLowerCase() // Return normalized username
    })

  } catch (error) {
    console.error('Username availability check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}