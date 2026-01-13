import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with subscription info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        paid,
        paid_at,
        stripe_subscription_id,
        stripe_customer_id,
        subscription_status,
        subscription_cancel_at_period_end,
        subscription_current_period_end,
        payment_amount_cents,
        payment_currency
      `)
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      isPaid: profile.paid || false,
      paidAt: profile.paid_at,
      subscriptionId: profile.stripe_subscription_id,
      customerId: profile.stripe_customer_id,
      status: profile.subscription_status || (profile.paid ? 'active' : 'none'),
      cancelAtPeriodEnd: profile.subscription_cancel_at_period_end || false,
      currentPeriodEnd: profile.subscription_current_period_end,
      amount: profile.payment_amount_cents,
      currency: profile.payment_currency || 'usd',
    });
  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
