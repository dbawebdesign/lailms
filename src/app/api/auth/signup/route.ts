import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Get request body
    const data = await req.json()
    const { inviteCode, username, password, firstName, lastName, gradeLevel } = data

    // Basic validation
    if (!inviteCode || !username || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Call Supabase Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sign-up-with-code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          inviteCode,
          username,
          password,
          firstName,
          lastName,
          gradeLevel,
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || 'Error creating user' },
        { status: response.status }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in signup API route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 