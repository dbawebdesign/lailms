import type { SupabaseClient } from '@supabase/supabase-js';

export class AttachmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function attachmentIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50 || value.some(id => typeof id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new AttachmentError('Attach up to 50 valid documents');
  }
  return Array.from(new Set(value));
}

export async function ownedAttachments(supabase: SupabaseClient, userId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('documents').select('id,file_name,status,metadata')
    .in('id', ids).eq('uploaded_by', userId);
  if (error) throw new AttachmentError('Could not read attachment status', 500);
  if (data?.length !== ids.length) throw new AttachmentError('Attachment not found or access denied', 403);
  return ids.map(id => data.find(doc => doc.id === id)!);
}

export async function attachmentContext(supabase: SupabaseClient, userId: string, ids: string[]) {
  const documents = await ownedAttachments(supabase, userId, ids);
  if (!documents.length) return '';
  const failed = documents.find(doc => doc.status === 'error');
  if (failed) throw new AttachmentError(`Attachment processing failed: ${failed.file_name}. Retry processing it before sending.`, 422);
  if (documents.some(doc => doc.status !== 'completed')) throw new AttachmentError('Attachments are still processing. Please try again shortly.', 409);
  const contents = new Map<string, string[]>(ids.map(id => [id, []]));
  let characters = 0;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('document_chunks').select('document_id,content')
      .in('document_id', ids).order('document_id').order('chunk_index').range(offset, offset + 499);
    if (error) throw new AttachmentError('Could not read attachment contents', 500);
    for (const chunk of data || []) {
      characters += chunk.content.length;
      if (characters > 200000) throw new AttachmentError('These attachments are too large to review together. Send fewer documents at a time.', 413);
      contents.get(chunk.document_id)?.push(chunk.content);
    }
    if (!data || data.length < 500) break;
    offset += 500;
  }
  return documents.map(doc => {
    const content = contents.get(doc.id)?.join('\n\n');
    if (!content?.trim()) throw new AttachmentError(`No readable text found in attachment: ${doc.file_name}`, 422);
    return `<attachment name=${JSON.stringify(doc.file_name)} id=${JSON.stringify(doc.id)}>\n${content}\n</attachment>`;
  }).join('\n\n');
}
