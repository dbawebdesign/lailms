'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, CreditCard, Users, Shield, MessageSquare, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUIContext } from '@/context/UIContext';
import ProfileSettingsSection from './ProfileSettingsSection';
import SubscriptionSection from './SubscriptionSection';
import StudentManagementSection from './StudentManagementSection';
import SecuritySettingsSection from './SecuritySettingsSection';

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

interface SettingsPageClientProps {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
}

export default function SettingsPageClient({ user, profile }: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const router = useRouter();
  const { openFeedbackModal } = useUIContext();

  const handleBack = () => {
    router.back();
  };

  const handleFeedback = () => {
    openFeedbackModal({ category: 'support' });
  };

  // Determine if this is a homeschool account that has students
  const hasStudentManagement = profile.familyId !== null || profile.isPrimaryParent;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-muted-foreground text-sm">
                Manage your account settings and preferences
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFeedback}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback & Support</span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1">
            <TabsTrigger value="profile" className="gap-2 py-2.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            {hasStudentManagement && (
              <TabsTrigger value="students" className="gap-2 py-2.5">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Students</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="subscription" className="gap-2 py-2.5">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Subscription</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 py-2.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <ProfileSettingsSection
              user={user}
              profile={profile}
            />
          </TabsContent>

          {hasStudentManagement && (
            <TabsContent value="students" className="space-y-6 mt-6">
              <StudentManagementSection familyId={profile.familyId} />
            </TabsContent>
          )}

          <TabsContent value="subscription" className="space-y-6 mt-6">
            <SubscriptionSection profile={profile} />
          </TabsContent>

          <TabsContent value="security" className="space-y-6 mt-6">
            <SecuritySettingsSection user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
