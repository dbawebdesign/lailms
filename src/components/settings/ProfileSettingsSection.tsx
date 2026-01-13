'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

interface ProfileSettingsSectionProps {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
}

export default function ProfileSettingsSection({ user, profile }: ProfileSettingsSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [username, setUsername] = useState(profile.username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const validateUsername = (value: string) => {
    if (!value) {
      setUsernameError(null);
      return true;
    }
    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    if (value.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens');
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
    setIsSaved(false);
    validateUsername(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUsername(username)) {
      return;
    }

    setIsLoading(true);
    setIsSaved(false);

    try {
      const response = await fetch('/api/settings/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          username: username.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setUsernameError('Username is already taken');
          toast.error('Username is already taken');
        } else {
          toast.error(data.error || 'Failed to update profile');
        }
        return;
      }

      setIsSaved(true);
      toast.success('Profile updated successfully');
      
      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    firstName !== (profile.firstName || '') ||
    lastName !== (profile.lastName || '') ||
    username !== (profile.username || '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your personal information and display name
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if you need to update your email.
            </p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Enter username"
              className={usernameError ? 'border-destructive' : ''}
            />
            {usernameError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {usernameError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              3-20 characters, letters, numbers, underscores, and hyphens only
            </p>
          </div>

          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setIsSaved(false);
              }}
              placeholder="Enter first name"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setIsSaved(false);
              }}
              placeholder="Enter last name"
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={isLoading || !hasChanges || !!usernameError}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            {hasChanges && !isLoading && (
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
