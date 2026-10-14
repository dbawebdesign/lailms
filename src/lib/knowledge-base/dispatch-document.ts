import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export function dispatchDocument(supabase: SupabaseClient, documentId: string) {
  after(async () => {
    try {
      const { error } = await supabase.functions.invoke('process-document', {
        body: { documentId, background: true },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Document dispatch failed', { documentId, error });
      // Preserve the idempotency fingerprint and never label an already-running job failed.
      const { data } = await supabase.from('documents').select('metadata,status').eq('id', documentId).maybeSingle();
      if (data?.status === 'queued') await supabase.from('documents').update({
        status: 'error', metadata: { ...data.metadata, processing_error: {
          code: 'INVOCATION_FAILED', userFriendlyMessage: 'Processing could not start. Retry processing this source.',
          retryable: true, timestamp: new Date().toISOString(),
        } },
      }).eq('id', documentId).eq('status', 'queued');
    }
  });
}
