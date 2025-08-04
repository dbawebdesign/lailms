'use client';

import React, { useState } from 'react';
import { useRealtimeJobHealth } from '@/hooks/useRealtimeJobHealth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface GenerationHealthMonitorProps {
  jobId: string;
  onRestartRequest?: () => void;
  onDeleteRequest?: () => void;
  onRecoverySuccess?: () => void;
  className?: string;
}

export function GenerationHealthMonitor({
  jobId,
  onRestartRequest,
  onDeleteRequest,
  onRecoverySuccess,
  className
}: GenerationHealthMonitorProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const {
    health,
    isLoading,
    error,
    isRecovering,
    lastRecoveryResult,
    needsAttention,
    canRecover,
    isHealthy,
    progressPercentage,
    userMessage,
    recommendedAction,
    attemptRecovery,
    checkHealth
  } = useRealtimeJobHealth({
    jobId,
    enabled: true,
    onHealthChange: (newHealth) => {
      // Show toast notifications for status changes
      if (newHealth.status === 'stalled') {
        toast.warning('Generation is taking longer than expected', {
          description: 'We can try to resume it automatically.'
        });
      } else if (newHealth.status === 'stuck') {
        toast.error('Generation appears to be stuck', {
          description: 'Automatic recovery is available.'
        });
      } else if (newHealth.status === 'failed') {
        toast.error('Generation has failed', {
          description: 'You can try to restart the process.'
        });
      }
    },
    onRecoveryComplete: (result) => {
      if (result.success) {
        toast.success('Recovery initiated', {
          description: result.message
        });
        onRecoverySuccess?.();
      } else {
        toast.error('Recovery failed', {
          description: result.message
        });
      }
    }
  });

  const handleRecovery = async () => {
    try {
      await attemptRecovery();
    } catch (error) {
      toast.error('Recovery failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const handleManualCheck = async () => {
    try {
      await checkHealth();
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to check status', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    
    switch (health?.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'stalled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'stuck':
      case 'failed':
      case 'abandoned':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const variant = health?.status === 'healthy' ? 'default' : 
                   health?.status === 'stalled' ? 'secondary' : 'destructive';
    
    return (
      <Badge variant={variant} className="ml-2">
        {health?.status || 'unknown'}
      </Badge>
    );
  };

  const getActionButtons = () => {
    if (isRecovering) {
      return (
        <Button disabled className="w-full">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Attempting Recovery...
        </Button>
      );
    }

    switch (recommendedAction) {
      case 'resume':
        return (
          <div className="space-y-2">
            <Button 
              onClick={handleRecovery} 
              className="w-full"
              disabled={!canRecover}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Resume Generation
            </Button>
            <Button 
              variant="outline" 
              onClick={handleManualCheck} 
              className="w-full"
            >
              Check Status
            </Button>
          </div>
        );
      
      case 'restart':
        return (
          <div className="space-y-2">
            {canRecover && (
              <Button 
                onClick={handleRecovery} 
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Automatic Recovery
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={onRestartRequest} 
              className="w-full"
            >
              Restart from Beginning
            </Button>
          </div>
        );
      
      case 'delete_and_retry':
        return (
          <div className="space-y-2">
            <Button 
              variant="destructive" 
              onClick={onDeleteRequest} 
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete and Start Over
            </Button>
            <p className="text-sm text-gray-600">
              The generation is in an unrecoverable state. You'll need to delete the base class and upload your sources again.
            </p>
          </div>
        );
      
      case 'manual_intervention':
        return (
          <div className="space-y-2">
            <Button 
              variant="outline" 
              onClick={handleManualCheck} 
              className="w-full"
            >
              Check Status Again
            </Button>
            <p className="text-sm text-gray-600">
              This issue requires manual intervention. Please contact support if the problem persists.
            </p>
          </div>
        );
      
      default:
        return (
          <Button 
            variant="outline" 
            onClick={handleManualCheck} 
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Check Status
          </Button>
        );
    }
  };

  // Don't show the monitor if everything is healthy and progressing normally
  if (isHealthy && !needsAttention && !error) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon()}
            <CardTitle className="ml-2 text-lg">Generation Status</CardTitle>
            {getStatusBadge()}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
        <CardDescription>
          {userMessage}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {health && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{health.completedTasks} completed</span>
              <span>{health.totalTasks} total tasks</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Last Recovery Result */}
        {lastRecoveryResult && !lastRecoveryResult.success && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-700">
              <strong>Last Recovery Attempt:</strong> {lastRecoveryResult.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {needsAttention && getActionButtons()}

        {/* Detailed Information */}
        {showDetails && health && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md space-y-2">
            <h4 className="font-semibold text-sm">Detailed Information</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-medium">Running Tasks:</span> {health.runningTasks}
              </div>
              <div>
                <span className="font-medium">Pending Tasks:</span> {health.pendingTasks}
              </div>
              <div>
                <span className="font-medium">Failed Tasks:</span> {health.failedTasks}
              </div>
              <div>
                <span className="font-medium">Recovery Attempts:</span> {health.recoveryAttempts}/{health.maxRecoveryAttempts}
              </div>
            </div>
            {health.errorDetails && (
              <div className="mt-2">
                <span className="font-medium text-xs">Error Details:</span>
                <p className="text-xs text-gray-600 mt-1">{health.errorDetails}</p>
              </div>
            )}
            <div className="mt-2">
              <span className="font-medium text-xs">Last Activity:</span>
              <p className="text-xs text-gray-600">{health.lastActivity.toLocaleString()}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}