'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight } from 'lucide-react';

export default function EnrollPage() {
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleEnroll = async () => {
    if (!enrollmentCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an enrollment code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/learn/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enrollment_code: enrollmentCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enroll in class');
      }

      toast({
        title: 'Success!',
        description: data.message,
      });

      // Redirect to the courses page
      router.push('/learn/courses');
      router.refresh();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to enroll in class',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Enroll in a Class</CardTitle>
          <CardDescription>
            Enter the enrollment code provided by your instructor to join a class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter enrollment code"
                value={enrollmentCode}
                onChange={(e) => setEnrollmentCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEnroll()}
                disabled={isLoading}
              />
              <Button onClick={handleEnroll} disabled={isLoading}>
                {isLoading ? (
                  'Enrolling...'
                ) : (
                  <>
                    Enroll
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 