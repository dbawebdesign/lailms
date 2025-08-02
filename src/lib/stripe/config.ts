// Stripe configuration for payment integration

export const STRIPE_CONFIG = {
  // Replace with your actual Stripe Payment Link ID
  PAYMENT_LINK_BASE_URL: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL || 'https://buy.stripe.com/eVqbJ2agRaejc1V0Kb00001',
  
  // Success URL that Stripe will redirect to after payment
  SUCCESS_URL: process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`
    : 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
    
  // Cancel URL if user cancels payment
  CANCEL_URL: process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/signup?payment=cancelled`
    : 'http://localhost:3000/signup?payment=cancelled',
};

/**
 * Builds a Stripe Payment Link URL with user information
 */
export function buildPaymentLink(userId: string, userEmail?: string): string {
  const paymentLink = new URL(STRIPE_CONFIG.PAYMENT_LINK_BASE_URL);
  
  // Add user ID as client reference for webhook processing
  paymentLink.searchParams.set('client_reference_id', userId);
  
  // Optional: Pre-fill email if you want to (commented out to let users enter their own)
  // if (userEmail) {
  //   paymentLink.searchParams.set('prefilled_email', userEmail);
  // }
  
  return paymentLink.toString();
}

/**
 * Validates Stripe webhook environment variables
 */
export function validateStripeConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}