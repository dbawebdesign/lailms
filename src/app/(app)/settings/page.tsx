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
  if ((profile as any).is_sub_account) {
    redirect("/dashboard?error=settings_not_available");
  }

  // Cast to any to avoid TypeScript issues with dynamically selected fields
  const profileData = profile as any;

  return (
    <SettingsPageClient 
      user={{
        id: user.id,
        email: user.email || '',
      }}
      profile={{
        userId: profileData.user_id,
        username: profileData.username,
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        role: profileData.role,
        activeRole: profileData.active_role,
        organisationId: profileData.organisation_id,
        familyId: profileData.family_id,
        isSubAccount: profileData.is_sub_account,
        isPrimaryParent: profileData.is_primary_parent,
        paid: profileData.paid,
        paidAt: profileData.paid_at,
        stripeCustomerId: profileData.stripe_customer_id,
        stripeSubscriptionId: profileData.stripe_subscription_id,
        subscriptionStatus: profileData.subscription_status,
        subscriptionCancelAtPeriodEnd: profileData.subscription_cancel_at_period_end,
        subscriptionCurrentPeriodEnd: profileData.subscription_current_period_end,
        paymentAmountCents: profileData.payment_amount_cents,
        paymentCurrency: profileData.payment_currency,
      }}
    />
  );
}
