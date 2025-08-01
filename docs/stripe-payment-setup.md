# Stripe Payment Integration Setup Guide

This guide walks you through setting up Stripe payment integration for the homeschool signup flow.

## Overview

The payment integration works as follows:
1. User completes signup form
2. User account and profile are created in Supabase
3. User is redirected to Stripe Payment Link
4. After successful payment, Stripe webhook updates user profile
5. User is redirected to success page and can log in

## Step 1: Create Stripe Payment Link

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Products** → **Payment Links**
3. Click **Create payment link**
4. Configure your product/service:
   - Name: "Homeschool Subscription" (or your preferred name)
   - Price: Set your subscription price
   - Billing: Choose one-time or recurring
5. Under **Advanced Options**:
   - ✅ Enable "Allow promotion codes"
   - ✅ Enable "Redirect after payment"
   - Set success URL: `https://yourdomain.com/payment/success?session_id={CHECKOUT_SESSION_ID}`
   - Set cancel URL: `https://yourdomain.com/signup?payment=cancelled`
6. Save and copy the Payment Link URL (starts with `https://buy.stripe.com/...`)

## Step 2: Set Up Webhook Endpoint

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed` (required)
   - `customer.subscription.created` (optional)
   - `customer.subscription.updated` (optional)
   - `invoice.payment_succeeded` (optional)
   - `invoice.payment_failed` (optional)
5. Save and copy the **Signing secret** (starts with `whsec_...`)

## Step 3: Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/your_payment_link_id

# App Configuration (update with your domain)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Getting Your Stripe Secret Key

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy the **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)

## Step 4: Testing with Stripe CLI (Development)

For local development testing:

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the webhook signing secret from the CLI output and use it as `STRIPE_WEBHOOK_SECRET`
5. Use Stripe test card numbers for testing:
   - Success: `4242 4242 4242 4242`
   - Declined: `4000 0000 0000 0002`

## Step 5: Database Schema

The following columns have been added to the `profiles` table:

- `paid` (boolean, default false) - Whether user has completed payment
- `paid_at` (timestamptz) - When payment was completed
- `stripe_customer_id` (text) - Stripe customer ID
- `stripe_payment_intent_id` (text) - Payment transaction ID
- `stripe_receipt_url` (text) - Link to payment receipt
- `payment_amount_cents` (integer) - Payment amount in cents
- `payment_currency` (text, default 'usd') - Payment currency

## Step 6: Going Live

When ready for production:

1. Switch to Stripe live mode in dashboard
2. Update environment variables with live keys:
   - Use `sk_live_...` for `STRIPE_SECRET_KEY`
   - Create new webhook endpoint with production URL
   - Update `NEXT_PUBLIC_APP_URL` to your production domain
3. Test the full flow in production environment

## API Endpoints

### Webhook Endpoint
- **URL**: `/api/stripe/webhook`
- **Method**: POST
- **Purpose**: Processes Stripe webhook events and updates user profiles

### Payment Status Check
- **URL**: `/api/payment/status`
- **Method**: GET
- **Purpose**: Check current user's payment status
- **Authentication**: Required

## Payment Flow Pages

### Success Page
- **URL**: `/payment/success?session_id={CHECKOUT_SESSION_ID}`
- **Purpose**: Shows payment confirmation and redirects to login

## Security Considerations

1. **Webhook Signature Verification**: All webhooks are verified using Stripe's signature
2. **Service Role Key**: Webhook uses Supabase service role key for admin operations
3. **User ID Validation**: Payment updates require valid user ID from checkout session
4. **HTTPS Required**: Webhooks only work with HTTPS in production

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**:
   - Check webhook URL is accessible
   - Verify webhook signing secret
   - Check Stripe dashboard for delivery attempts

2. **Payment not updating profile**:
   - Check webhook logs in Stripe dashboard
   - Verify `client_reference_id` is being set correctly
   - Check Supabase service role key permissions

3. **Redirect not working**:
   - Verify success URL in Stripe Payment Link settings
   - Check `NEXT_PUBLIC_APP_URL` environment variable

### Logs

Check these locations for debugging:
- Stripe Dashboard → Webhooks → Your endpoint → Delivery attempts
- Your application logs for webhook processing
- Browser network tab for API calls

## Support

For Stripe-specific issues, refer to:
- [Stripe Documentation](https://docs.stripe.com/)
- [Stripe Webhook Testing](https://docs.stripe.com/webhooks/test)
- [Stripe Payment Links](https://docs.stripe.com/payment-links)