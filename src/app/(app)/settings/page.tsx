import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPageClient from "@/components/settings/SettingsPageClient";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect("/login?error=auth");
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      user_id,
      username,
      first_name,
      last_name,
      role,
      active_role,
      organisation_id,
      family_id,
      is_sub_account,
      is_primary_parent,
      paid,
      paid_at,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_status,
      subscription_cancel_at_period_end,
      subscription_current_period_end,
      payment_amount_cents,
      payment_currency
    `)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    redirect("/dashboard?error=profile");
  }

  // Check if user is a sub-account - redirect to dashboard
  if (profile.is_sub_account) {
    redirect("/dashboard?error=settings_not_available");
  }

  return (
    <SettingsPageClient 
      user={{
        id: user.id,
        email: user.email || '',
      }}
      profile={{
        userId: profile.user_id,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        activeRole: profile.active_role,
        organisationId: profile.organisation_id,
        familyId: profile.family_id,
        isSubAccount: profile.is_sub_account,
        isPrimaryParent: profile.is_primary_parent,
        paid: profile.paid,
        paidAt: profile.paid_at,
        stripeCustomerId: profile.stripe_customer_id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        subscriptionStatus: profile.subscription_status,
        subscriptionCancelAtPeriodEnd: profile.subscription_cancel_at_period_end,
        subscriptionCurrentPeriodEnd: profile.subscription_current_period_end,
        paymentAmountCents: profile.payment_amount_cents,
        paymentCurrency: profile.payment_currency,
      }}
    />
  );
}
