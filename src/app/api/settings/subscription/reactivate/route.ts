import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
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
      .select('stripe_subscription_id, stripe_customer_id, subscription_status, subscription_cancel_at_period_end, is_sub_account')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account
    if ((profile as any).is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot manage subscriptions' }, { status: 403 });
    }

    // Check if user has a subscription
    if (!(profile as any).stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    // Check if subscription is set to cancel
    if (!(profile as any).subscription_cancel_at_period_end) {
      return NextResponse.json({ error: 'Subscription is not set to cancel' }, { status: 400 });
    }

    // Check if subscription is already fully canceled
    if ((profile as any).subscription_status === 'canceled') {
      return NextResponse.json({ 
        error: 'Subscription has already been canceled. Please create a new subscription.' 
      }, { status: 400 });
    }

    // Reactivate subscription by removing cancel_at_period_end
    const subscription = await stripe.subscriptions.update((profile as any).stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_cancel_at_period_end: false,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription has been reactivated',
      status: subscription.status,
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reactivate subscription' },
      { status: 500 }
    );
  }
}
