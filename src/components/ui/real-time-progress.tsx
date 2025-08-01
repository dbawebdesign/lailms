'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useProgressStream } from '@/hooks/use-progress-stream';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimeProgressProps {
  jobId: string;
}

// JobStatus interface removed - now using progress data from useProgressStream

export function RealTimeProgress({ jobId }: RealTimeProgressProps) {
  const { progress, isConnected, error, reconnect } = useProgressStream(jobId);
  
  // Remove duplicate polling - useProgressStream already handles job status polling

  // Connection status indicator
  const connectionStatus = () => {
    if (error) {
      return (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Connection error</span>
        </div>
      );
    }
    
    // Show progress status if available
    if (progress?.status === 'completed') {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed</span>
        </div>
      );
    }
    
    if (progress?.status === 'failed') {
      return (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Failed</span>
        </div>
      );
    }
    
    if (!isConnected && !progress) {
      return (
        <div className="flex items-center gap-2 text-yellow-600 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <Activity className="w-4 h-4" />
        <span>Live updates</span>
      </div>
    );
  };

  // Display current activity message (use streaming data from useProgressStream)
  const getCurrentActivity = () => {
    // Use streaming progress data
    if (progress?.liveMessage?.message) {
      return progress.liveMessage.message;
    }
    
    if (progress?.detailedMessage && progress.detailedMessage !== 'Initializing...') {
      return progress.detailedMessage;
    }
    
    // Fallback based on progress status
    if (progress?.status === 'processing') {
      return 'Processing...';
    }
    
    if (progress?.status === 'queued') {
      return 'Queued for processing...';
    }
    
    if (progress?.status === 'completed') {
      return 'Course generation completed!';
    }
    
    if (progress?.status === 'failed') {
      return progress?.error || 'Generation failed';
    }
    
    return 'Initializing...';
  };

  // Get message level styling
  const getMessageStyling = () => {
    if (!progress?.liveMessage) return 'text-gray-700';
    
    switch (progress.liveMessage.level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'info':
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="w-full space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Course Generation Progress
        </h3>
        {connectionStatus()}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm font-medium text-gray-900">
            {progress ? `${Math.round(progress.overallProgress)}%` : '0%'}
          </span>
        </div>
        <Progress 
          value={progress?.overallProgress || 0} 
          className="h-3"
        />
      </div>

      {/* Current Activity */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Current Activity
          </span>
        </div>
        
        <div className={cn(
          "text-sm font-medium p-3 rounded-md bg-gray-50 border",
          getMessageStyling()
        )}>
          {getCurrentActivity()}
        </div>
      </div>

      {/* Estimated Time */}
      {progress?.estimatedTimeRemaining && progress.estimatedTimeRemaining !== 'Calculating...' && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Estimated time remaining: {progress.estimatedTimeRemaining}</span>
        </div>
      )}

      {/* Current Phase */}
      {progress?.currentPhase && progress.currentPhase !== 'unknown' && (
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
          Phase: {progress.currentPhase} - {progress.phaseDescription}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Connection Error</span>
          </div>
          <p className="text-sm text-red-600">{error}</p>
          <Button 
            onClick={reconnect}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconnect
          </Button>
        </div>
      )}

      {/* Completion State */}
      {(progress?.overallProgress === 100 || progress?.status === 'completed') && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Generation Complete!</span>
        </div>
      )}

      {/* Failed State */}
      {progress?.status === 'failed' && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Generation Failed</span>
          {progress?.error && (
            <p className="text-sm text-red-600 mt-1">{progress.error}</p>
          )}
        </div>
      )}
    </div>
  );
} 