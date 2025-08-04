import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for pending messages
    const { data, error } = await supabase
      .from('admin_messages')
      .select(`
        id,
        from_admin_id,
        subject,
        message,
        created_at,
        updated_at,
        admin_message_responses (id)
      `)
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching admin messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Find the first message without a response
    const pendingMessage = data?.find(msg => msg.admin_message_responses.length === 0)
    
    return NextResponse.json({ 
      hasPendingMessage: !!pendingMessage,
      message: pendingMessage || null
    })
  } catch (error) {
    console.error('Error in admin messages check API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}