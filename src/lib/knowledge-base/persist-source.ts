import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export class SourceUploadError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

export interface SourceInput {
  userId: string;
  organisationId: string;
  baseClassId: string | null;
  fileName: string;
  fileType: string;
  content: Blob | string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
  urlType?: string;
}

export async function sourceFingerprint(input: SourceInput): Promise<string> {
  const hash = createHash('sha256');
  hash.update(JSON.stringify([input.fileName, input.fileType, input.baseClassId]));
  if (typeof input.content === 'string') hash.update(input.content);
  else {
    const reader = input.content.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
      }
    } finally { reader.releaseLock(); }
  }
  return hash.digest('hex');
}

export function sourceDocumentId(input: Pick<SourceInput, 'userId' | 'organisationId' | 'baseClassId' | 'idempotencyKey'>): string {
  if (!input.idempotencyKey) return randomUUID();
  const hex = createHash('sha256').update(JSON.stringify([
    'knowledge-source-v1', input.userId, input.organisationId, input.baseClassId, input.idempotencyKey,
  ])).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Replays reuse one document ID; identical content can still be used in another course/request. */
export async function persistSource(supabase: SupabaseClient, input: SourceInput) {
  if (input.idempotencyKey && !/^[a-zA-Z0-9_.:-]{1,128}$/.test(input.idempotencyKey)) {
    throw new SourceUploadError('Invalid upload request key', 400);
  }
  if (input.baseClassId) {
    const { data, error } = await supabase.from('base_classes').select('id')
      .eq('id', input.baseClassId).eq('organisation_id', input.organisationId).maybeSingle();
    if (error) throw new SourceUploadError('Could not verify course access');
    if (!data) throw new SourceUploadError('Course not found or access denied', 403);
  }
  const fingerprint = input.idempotencyKey ? await sourceFingerprint(input) : null;
  const id = sourceDocumentId(input);
  const findReplay = async () => {
    const { data, error } = await supabase.from('documents').select('id,status,metadata')
      .eq('id', id).eq('uploaded_by', input.userId).eq('organisation_id', input.organisationId).maybeSingle();
    if (error) throw new SourceUploadError('Could not verify existing upload');
    if (!data) return null;
    if (data.metadata?.upload_fingerprint !== fingerprint) {
      throw new SourceUploadError('This upload request key was already used for different content', 409);
    }
    return { id: data.id as string, status: data.status as string, reused: true };
  };
  if (input.idempotencyKey) {
    const replay = await findReplay();
    if (replay) return replay;
  }

  // A content hash in keyed storage paths prevents a conflicting replay from replacing a file.
  const identifier = fingerprint ? `${id}-${fingerprint}` : id;
  const path = input.urlType ? `urls/${input.urlType}/${identifier}.url`
    : `${input.userId}-${identifier}-${input.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const bucket = `org-${input.organisationId}-uploads`;
  const upload = () => supabase.storage.from(bucket).upload(path, input.content, {
    contentType: input.urlType ? 'text/plain' : input.fileType,
    cacheControl: '3600', upsert: false,
  });
  let { error: storageError } = await upload();
  if (storageError?.message.includes('Bucket not found')) {
    const { error } = await createSupabaseServiceClient().storage.createBucket(bucket, {
      public: false, fileSizeLimit: 52428800,
      allowedMimeTypes: ['application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint', 'text/csv', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    });
    if (error && !error.message.includes('already exists')) throw new SourceUploadError('Failed to prepare upload storage');
    ({ error: storageError } = await upload());
  }
  const storageConflict = storageError && (String((storageError as { statusCode?: string }).statusCode) === '409'
    || /already exists|Duplicate/i.test(storageError.message));
  if (storageError && !(input.idempotencyKey && storageConflict)) {
    throw new SourceUploadError(`Failed to store source: ${storageError.message}`);
  }

  const metadata = { ...input.metadata, ...(fingerprint ? { upload_fingerprint: fingerprint } : {}) };
  const { data, error } = await supabase.from('documents').insert({
    id, uploaded_by: input.userId, organisation_id: input.organisationId,
    base_class_id: input.baseClassId, file_name: input.fileName, file_type: input.fileType,
    file_size: typeof input.content === 'string' ? input.content.length : input.content.size,
    storage_path: path, status: 'queued', metadata,
  }).select('id,status').single();
  if (error) {
    if (input.idempotencyKey && error.code === '23505') {
      const replay = await findReplay();
      if (replay) return replay;
    }
    // Keep keyed files for a safe retry after a database/network failure.
    if (!input.idempotencyKey) await supabase.storage.from(bucket).remove([path]);
    throw new SourceUploadError('Failed to save upload metadata');
  }
  return { id: data.id as string, status: data.status as string, reused: false };
}
