'use client';

import React from 'react';
import { AlertCircle, RefreshCw, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDocumentErrorMessage, getErrorSuggestedActions, isRetryableError } from '@/lib/document-processing-utils';

interface DocumentError {
  id: string;
  fileName: string;
  metadata: any;
}

interface DocumentProcessingErrorProps {
  errors: DocumentError[];
  onRetry?: (documentIds: string[]) => Promise<void>;
  onDismiss?: () => void;
}

export function DocumentProcessingError({ 
  errors, 
  onRetry,
  onDismiss 
}: DocumentProcessingErrorProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const retryableErrors = errors.filter(err => isRetryableError(err.metadata));
  const nonRetryableErrors = errors.filter(err => !isRetryableError(err.metadata));

  const handleRetry = async () => {
    if (!onRetry || retryableErrors.length === 0) return;
    
    setIsRetrying(true);
    try {
      await onRetry(retryableErrors.map(err => err.id));
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {errors.length === 1 
            ? '1 document failed to process'
            : `${errors.length} documents failed to process`}
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {errors.map((error) => {
          const errorMessage = getDocumentErrorMessage(error.metadata);
          const suggestedActions = getErrorSuggestedActions(error.metadata);
          const canRetry = isRetryableError(error.metadata);

          return (
            <Card key={error.id} className="border-destructive/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <FileWarning className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <CardTitle className="text-base">{error.fileName}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {errorMessage}
                      </CardDescription>
                    </div>
                  </div>
                  {canRetry && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Retryable
                    </span>
                  )}
                </div>
              </CardHeader>
              {suggestedActions.length > 0 && (
                <CardContent className="pt-0">
                  <div className="text-sm">
                    <p className="font-medium mb-2">Suggested actions:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {suggestedActions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3 justify-end">
        {onDismiss && (
          <Button
            variant="outline"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        )}
        {onRetry && retryableErrors.length > 0 && (
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            Retry {retryableErrors.length === 1 ? 'Document' : `${retryableErrors.length} Documents`}
          </Button>
        )}
      </div>
    </div>
  );
}
