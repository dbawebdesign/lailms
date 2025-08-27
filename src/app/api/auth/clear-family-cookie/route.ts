import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // Clear the active family member cookie
    cookieStore.delete('active_family_member')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing family cookie:', error)
    return NextResponse.json(
      { error: 'Failed to clear family cookie' },
      { status: 500 }
    )
  }
}

