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
      .select('stripe_subscription_id, stripe_customer_id, subscription_status, is_sub_account, paid')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is a sub-account (they can't manage subscriptions)
    if (profile.is_sub_account) {
      return NextResponse.json({ error: 'Sub-accounts cannot manage subscriptions' }, { status: 403 });
    }

    // Check if subscription is already canceled
    if (profile.subscription_status === 'canceled') {
      return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 });
    }

    let subscriptionId = profile.stripe_subscription_id;

    // If we don't have subscription ID but have customer ID, look it up from Stripe
    if (!subscriptionId && profile.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        subscriptionId = subscriptions.data[0].id;
      }
    }

    // Check if user has a subscription
    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Cancel subscription at end of billing period
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update profile with cancellation info and subscription ID if we looked it up
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_cancel_at_period_end: true,
        subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // Don't fail the request since Stripe was updated successfully
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
