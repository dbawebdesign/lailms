import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, response } = body

    if (!messageId || !response?.trim()) {
      return NextResponse.json({ error: 'Message ID and response are required' }, { status: 400 })
    }

    // Verify the message belongs to the current user
    const { data: message, error: messageError } = await supabase
      .from('admin_messages')
      .select('id, to_user_id')
      .eq('id', messageId)
      .eq('to_user_id', user.id)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found or unauthorized' }, { status: 404 })
    }

    // Check if already responded
    const { data: existingResponse } = await supabase
      .from('admin_message_responses')
      .select('id')
      .eq('message_id', messageId)
      .single()

    if (existingResponse) {
      return NextResponse.json({ error: 'Message already responded to' }, { status: 400 })
    }

    // Submit the response
    const { error: responseError } = await supabase
      .from('admin_message_responses')
      .insert({
        message_id: messageId,
        response: response.trim()
      })

    if (responseError) {
      console.error('Error submitting response:', responseError)
      return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin messages respond API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}