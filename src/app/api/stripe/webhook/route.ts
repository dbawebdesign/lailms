import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin operations
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing Stripe signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log('Received Stripe event:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (!userId) {
          console.error('No client_reference_id found in checkout session:', session.id);
          return NextResponse.json({ error: 'No user ID found' }, { status: 400 });
        }

        console.log('Processing payment for user:', userId);

        // Get payment details
        const paymentIntentId = session.payment_intent as string;
        let receiptUrl: string | null = null;
        let amountCents: number | null = null;
        let currency: string | null = null;

        if (paymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ['latest_charge'],
            });

            const charge = paymentIntent.latest_charge as Stripe.Charge;
            receiptUrl = charge?.receipt_url || null;
            amountCents = paymentIntent.amount;
            currency = paymentIntent.currency;
          } catch (error) {
            console.error('Error retrieving payment intent:', error);
            // Continue without receipt URL
          }
        }

        // Update user profile in Supabase
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            paid: true,
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId,
            stripe_receipt_url: receiptUrl,
            payment_amount_cents: amountCents,
            payment_currency: currency || 'usd',
            stripe_customer_id: session.customer as string,
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating user profile:', updateError);
          return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
        }

        console.log('Successfully updated payment status for user:', userId);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get the current period end date
        const currentPeriodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Update subscription fields in profiles
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_cancel_at_period_end: subscription.cancel_at_period_end,
            subscription_current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        } else {
          console.log('Updated subscription status for customer:', customerId, 'Status:', subscription.status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Mark subscription as canceled and set is_canceled flag
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_cancel_at_period_end: false,
            is_canceled: true,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (updateError) {
          console.error('Error updating canceled subscription:', updateError);
        } else {
          console.log('Subscription canceled for customer:', customerId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Handle successful recurring payments
        console.log('Payment succeeded for customer:', customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Handle failed payments - could send notification or update status
        console.log('Payment failed for customer:', customerId);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}