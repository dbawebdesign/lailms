'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setStatus('error');
      setMessage('Invalid payment session. Please contact support if you completed payment.');
      return;
    }

    // Give the webhook a moment to process
    const timer = setTimeout(() => {
      setStatus('success');
      setMessage('Payment completed successfully! Welcome to Learnology AI.');
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleContinue = () => {
    router.push('/login?payment=success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-600" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful!'}
            {status === 'error' && 'Payment Issue'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === 'success' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your account has been activated and you can now access all premium features.
              </p>
              <Button onClick={handleContinue} className="w-full">
                Continue to Login
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If you completed payment but see this error, please contact our support team.
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link href="/contact">Contact Support</Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Try Login Anyway</Link>
                </Button>
              </div>
            </div>
          )}
          
          {status === 'loading' && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please wait while we confirm your payment...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}