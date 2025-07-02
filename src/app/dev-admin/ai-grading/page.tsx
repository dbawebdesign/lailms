'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface GradingStatus {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

interface BatchResponse {
  success: boolean;
  message: string;
  attemptIds: string[];
  totalAttempts: number;
  status: string;
}

export default function AIGradingAdminPage() {
  const [status, setStatus] = useState<GradingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGradingStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/learn/assessments/grade/batch');
      const data = await response.json();
      
      if (response.ok) {
        setStatus(data.summary);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const triggerBatchGrading = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setError(null);
      
      const response = await fetch('/api/learn/assessments/grade/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data: BatchResponse = await response.json();
      
      if (response.ok) {
        setMessage(`Batch grading started for ${data.totalAttempts} attempts`);
        setError(null);
        // Refresh status after a short delay
        setTimeout(fetchGradingStatus, 2000);
      } else {
        setError(data.message || 'Failed to start batch grading');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Grading Administration</h1>
          <p className="text-muted-foreground">
            Manage and monitor AI grading for assessment attempts
          </p>
        </div>
        <Button 
          onClick={fetchGradingStatus}
          disabled={loading}
          variant="outline"
        >
          {loading ? 'Loading...' : 'Refresh Status'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.pending || 0}</div>
            <Badge variant="secondary">Awaiting AI Grading</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.inProgress || 0}</div>
            <Badge variant="default">Currently Grading</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.completed || 0}</div>
            <Badge variant="outline" className="text-green-600">Graded</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.failed || 0}</div>
            <Badge variant="destructive">Errors</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Processing</CardTitle>
          <CardDescription>
            Process all pending assessment attempts that have subjective questions requiring AI grading.
            This will automatically grade short answer and essay questions using AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={triggerBatchGrading}
              disabled={loading || (status?.pending || 0) === 0}
              size="lg"
            >
              {loading ? 'Processing...' : `Process ${status?.pending || 0} Pending Attempts`}
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>This process will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Find all assessment attempts with pending AI grading status</li>
              <li>Filter for attempts that have subjective questions (short answer, essay)</li>
              <li>Use AI to grade each response based on answer keys and sample responses</li>
              <li>Update attempt scores and mark assessments as complete</li>
              <li>Run in the background to avoid timeouts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 