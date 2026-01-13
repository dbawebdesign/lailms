'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Shield, ExternalLink, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface SecuritySettingsSectionProps {
  user: {
    id: string;
    email: string;
  };
}

export default function SecuritySettingsSection({ user }: SecuritySettingsSectionProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const supabase = createClient();

  const handlePasswordReset = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });

      if (error) {
        toast.error(error.message || 'Failed to send password reset email');
        return;
      }

      setResetEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset email');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>
          Manage your account security and authentication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Section */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Change your account password
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handlePasswordReset}
              disabled={isResetting || resetEmailSent}
              className="gap-2"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resetEmailSent ? (
                <>
                  <Check className="h-4 w-4" />
                  Email Sent
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
          
          {resetEmailSent && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-600">
              A password reset link has been sent to <strong>{user.email}</strong>. 
              Please check your inbox and follow the instructions.
            </div>
          )}
        </div>

        {/* Account Security Info */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">Account Security</p>
          </div>
          
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email Verified</span>
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                Verified
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account Type</span>
              <Badge variant="secondary">Email & Password</Badge>
            </div>
          </div>
        </div>

        {/* Security Tips */}
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-sm font-medium mb-2">Security Tips</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Use a strong, unique password</li>
            <li>• Never share your login credentials</li>
            <li>• Enable notifications for account activity</li>
            <li>• Log out when using shared devices</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
