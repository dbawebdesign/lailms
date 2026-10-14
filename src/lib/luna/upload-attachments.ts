interface FileAttachment { id: string; file: File }
interface UrlAttachment { id: string; url: string }

/** Retain completed upload IDs across a failed send instead of uploading those files again. */
export async function uploadChatAttachments(files: FileAttachment[], urls: UrlAttachment[], uploads: Map<string, string>) {
  if (files.length + urls.length > 50) throw new Error('Attach up to 50 documents at a time');
  for (const item of [...files, ...urls]) {
    if (uploads.has(item.id)) continue;
    let response: Response;
    if ('file' in item) {
      const form = new FormData();
      form.append('file', item.file);
      response = await fetch('/api/knowledge-base/upload', {
        method: 'POST', headers: { 'Idempotency-Key': item.id }, body: form,
      });
    } else {
      response = await fetch('/api/knowledge-base/url', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': item.id },
        body: JSON.stringify({ url: item.url, type: /youtube\.com|youtu\.be/.test(item.url) ? 'youtube' : 'webpage' }),
      });
    }
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error(data.error || 'Attachment upload failed');
    uploads.set(item.id, data.id);
  }
  return [...files, ...urls].map(item => uploads.get(item.id)!);
}

export async function waitForChatAttachments(documentIds: string[]) {
  if (!documentIds.length) return;
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await fetch('/api/luna/attachments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentIds }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to check attachments');
    const failed = data.documents.find((doc: { status: string }) => doc.status === 'error');
    if (failed) throw new Error(`Could not process ${failed.name}. Retry it in your knowledge base or remove this attachment.`);
    if (data.documents.length === documentIds.length && data.documents.every((doc: { status: string }) => doc.status === 'completed')) return;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('Attachments are taking longer than expected. Your uploads are saved; try sending again shortly.');
}
