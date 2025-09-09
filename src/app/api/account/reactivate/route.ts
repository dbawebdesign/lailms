import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()
    const supabase = createSupabaseServerClient()
    const supabaseAdmin = createSupabaseServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .eq('user_id', user.id)
      .single()

    const firstName = (profile as any)?.first_name || ''
    const lastName = (profile as any)?.last_name || ''
    const email = (profile as any)?.email || user.email || ''

    // Send email via Resend if configured
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const TO = 'areyes@learnologyai.com'
    const FROM = process.env.RESEND_FROM_EMAIL || 'no-reply@learnologyai.com'

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set; skipping email send')
    } else {
      const subject = `Reactivation request from ${firstName || ''} ${lastName || ''}`.trim()
      const html = `
        <h2>Account Reactivation Request</h2>
        <p><strong>User ID:</strong> ${user.id}</p>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap">${(message || '').toString()}</pre>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          subject,
          html,
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('reactivate error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


