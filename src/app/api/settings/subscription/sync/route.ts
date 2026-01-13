import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Use service role for admin updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with stripe customer id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, is_sub_account, paid')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account
    if ((profile as any).is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot manage subscriptions' }, { status: 403 });
    }

    // Check if user has a Stripe customer ID
    if (!(profile as any).stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found for this account' }, { status: 400 });
    }

    // Fetch all subscriptions for this customer from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: (profile as any).stripe_customer_id,
      status: 'all',
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ 
        error: 'No subscriptions found in Stripe for this customer',
        synced: false 
      }, { status: 404 });
    }

    // Get the most recent active subscription (or most recent if none active)
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    ) || subscriptions.data[0];

    // Get subscription item details for amount
    let amountCents: number | null = null;
    let currency: string = 'usd';
    
    if (activeSubscription.items.data.length > 0) {
      const item = activeSubscription.items.data[0];
      if (item.price.unit_amount) {
        amountCents = item.price.unit_amount;
        currency = item.price.currency;
      }
    }

    // Calculate current period end
    const currentPeriodEnd = activeSubscription.current_period_end 
      ? new Date(activeSubscription.current_period_end * 1000).toISOString()
      : null;

    // Update profile with subscription data using service role
    const updateData: Record<string, any> = {
      stripe_subscription_id: activeSubscription.id,
      subscription_status: activeSubscription.status,
      subscription_cancel_at_period_end: activeSubscription.cancel_at_period_end,
      subscription_current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    };

    // Also update payment amount if we found it
    if (amountCents !== null) {
      updateData.payment_amount_cents = amountCents;
      updateData.payment_currency = currency;
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile with subscription data:', updateError);
      return NextResponse.json({ error: 'Failed to update subscription data' }, { status: 500 });
    }

    return NextResponse.json({
      synced: true,
      subscription: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        currentPeriodEnd,
        amount: amountCents,
        currency,
      },
      message: 'Subscription data synced successfully',
    });
  } catch (error: any) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
