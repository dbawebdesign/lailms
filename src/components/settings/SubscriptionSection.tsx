'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, XCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserProfile {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  activeRole: string | null;
  organisationId: string | null;
  familyId: string | null;
  isSubAccount: boolean;
  isPrimaryParent: boolean;
  paid: boolean;
  paidAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionCancelAtPeriodEnd: boolean;
  subscriptionCurrentPeriodEnd: string | null;
  paymentAmountCents: number | null;
  paymentCurrency: string | null;
}

interface SubscriptionSectionProps {
  profile: UserProfile;
}

export default function SubscriptionSection({ profile }: SubscriptionSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(profile.subscriptionCancelAtPeriodEnd);
  const [subscriptionStatus, setSubscriptionStatus] = useState(profile.subscriptionStatus);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (cents: number | null, currency: string | null) => {
    if (!cents) return 'N/A';
    const amount = cents / 100;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    });
    return formatter.format(amount);
  };

  const getStatusBadge = () => {
    if (!profile.paid) {
      return <Badge variant="secondary">No Subscription</Badge>;
    }
    
    if (cancelAtPeriodEnd) {
      return <Badge variant="destructive">Canceling</Badge>;
    }
    
    switch (subscriptionStatus) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      case 'incomplete':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Incomplete</Badge>;
      default:
        return <Badge>Active</Badge>;
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const response = await fetch('/api/settings/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to cancel subscription');
        return;
      }

      setCancelAtPeriodEnd(true);
      toast.success('Subscription will be canceled at the end of the billing period');
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsReactivating(true);
    try {
      const response = await fetch('/api/settings/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to reactivate subscription');
        return;
      }

      setCancelAtPeriodEnd(false);
      setSubscriptionStatus(data.status);
      toast.success('Subscription has been reactivated');
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('Failed to reactivate subscription');
    } finally {
      setIsReactivating(false);
    }
  };

  const canCancelSubscription = profile.paid && 
    profile.stripeSubscriptionId && 
    subscriptionStatus !== 'canceled' && 
    !cancelAtPeriodEnd;

  const canReactivateSubscription = profile.paid && 
    profile.stripeSubscriptionId && 
    cancelAtPeriodEnd && 
    subscriptionStatus !== 'canceled';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Subscription Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">
              {cancelAtPeriodEnd 
                ? 'Canceling at period end' 
                : subscriptionStatus 
                  ? subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)
                  : profile.paid ? 'Active' : 'No subscription'}
            </p>
          </div>
          
          {profile.paid && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium">
                  {formatAmount(profile.paymentAmountCents, profile.paymentCurrency)}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="font-medium">{formatDate(profile.paidAt)}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
                </p>
                <p className="font-medium">
                  {formatDate(profile.subscriptionCurrentPeriodEnd)}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Cancellation Warning */}
        {cancelAtPeriodEnd && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600">Subscription Canceling</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your subscription is set to cancel on {formatDate(profile.subscriptionCurrentPeriodEnd)}. 
                  You will continue to have access until then. You can reactivate anytime before that date.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Subscription */}
        {!profile.paid && (
          <div className="rounded-lg border border-muted bg-muted/30 p-4 text-center">
            <p className="text-muted-foreground">
              You don&apos;t have an active subscription.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {canCancelSubscription && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isCanceling}>
                  {isCanceling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Canceling...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel Subscription
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your subscription? 
                    <br /><br />
                    <strong>Your subscription will remain active until {formatDate(profile.subscriptionCurrentPeriodEnd)}</strong>. 
                    After that date, you will lose access to premium features.
                    <br /><br />
                    You can reactivate your subscription anytime before the end of the billing period.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canReactivateSubscription && (
            <Button
              variant="default"
              onClick={handleReactivateSubscription}
              disabled={isReactivating}
            >
              {isReactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reactivating...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reactivate Subscription
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
