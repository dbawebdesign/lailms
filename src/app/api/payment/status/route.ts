import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  try {
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's payment status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('paid, paid_at, stripe_receipt_url, payment_amount_cents, payment_currency')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 });
    }

    return NextResponse.json({
      paid: profile.paid || false,
      paid_at: profile.paid_at,
      receipt_url: profile.stripe_receipt_url,
      amount_cents: profile.payment_amount_cents,
      currency: profile.payment_currency || 'usd',
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}