/**
 * Utility functions for document processing operations
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Retry processing for failed documents
 * @param documentIds Array of document IDs to retry
 * @returns Object with success status and any errors
 */
export async function retryFailedDocuments(documentIds: string[]): Promise<{
  success: boolean;
  retriedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let retriedCount = 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      retriedCount: 0,
      errors: ['Supabase configuration missing']
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  for (const documentId of documentIds) {
    try {
      // Reset document status to queued
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'queued',
          metadata: supabase.rpc('jsonb_set', {
            target: 'metadata',
            path: '{retry_attempted_at}',
            new_value: JSON.stringify(new Date().toISOString())
          })
        })
        .eq('id', documentId);

      if (updateError) {
        errors.push(`Failed to reset document ${documentId}: ${updateError.message}`);
        continue;
      }

      // Invoke process-document function
      const { error: invokeError } = await supabase.functions.invoke('process-document', {
        body: { documentId }
      });

      if (invokeError) {
        errors.push(`Failed to invoke processing for ${documentId}: ${invokeError.message}`);
        continue;
      }

      retriedCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Error retrying document ${documentId}: ${errorMsg}`);
    }
  }

  return {
    success: errors.length === 0,
    retriedCount,
    errors
  };
}

/**
 * Check if a document has a retryable error
 * @param metadata Document metadata object
 * @returns true if the error is retryable
 */
export function isRetryableError(metadata: any): boolean {
  const error = metadata?.processing_error;
  
  if (!error) return false;

  // Check for retryable flag
  if (error.retryable === true) return true;

  // Check for specific retryable error types
  const retryableErrors = [
    'timeout',
    'network',
    'rate_limit',
    '429',
    '503',
    '502',
    'ECONNRESET',
    'ETIMEDOUT'
  ];

  const errorMessage = (error.message || '').toLowerCase();
  return retryableErrors.some(err => errorMessage.includes(err.toLowerCase()));
}

/**
 * Get user-friendly error message for document processing errors
 * @param metadata Document metadata object
 * @returns User-friendly error message
 */
export function getDocumentErrorMessage(metadata: any): string {
  const error = metadata?.processing_error;
  
  if (!error) return 'Unknown error occurred';

  // Check for OpenAI API key errors
  if (error.message?.includes('Incorrect API key') || error.message?.includes('invalid_api_key')) {
    return 'Configuration error: The document processing service is experiencing authentication issues. Please contact support.';
  }

  // Check for rate limiting
  if (error.message?.includes('429') || error.message?.includes('rate limit')) {
    return 'The service is currently experiencing high demand. Please try again in a few minutes.';
  }

  // Check for timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
    return 'Processing took too long and timed out. Try splitting large documents into smaller parts.';
  }

  // Return user-friendly message if available, otherwise the raw message
  return error.userFriendlyMessage || error.message || 'Processing failed';
}

/**
 * Get suggested actions for document processing errors
 * @param metadata Document metadata object
 * @returns Array of suggested actions
 */
export function getErrorSuggestedActions(metadata: any): string[] {
  const error = metadata?.processing_error;
  
  if (!error) return ['Try uploading the document again'];

  // Return suggested actions if available
  if (error.suggestedActions && Array.isArray(error.suggestedActions)) {
    return error.suggestedActions;
  }

  // Default suggestions based on error type
  if (error.message?.includes('Incorrect API key') || error.message?.includes('invalid_api_key')) {
    return ['Contact support for assistance'];
  }

  if (error.message?.includes('timeout')) {
    return [
      'Try splitting the document into smaller parts',
      'Reduce document complexity by removing images',
      'Try again during off-peak hours'
    ];
  }

  return [
    'Try uploading the document again',
    'Check that the document is not corrupted',
    'Contact support if the issue persists'
  ];
}
