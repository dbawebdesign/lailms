/** @jest-environment node */
import { attachmentContext, attachmentIds } from '../src/lib/luna/attachments';
import { uploadChatAttachments, waitForChatAttachments } from '../src/lib/luna/upload-attachments';
const id = '11111111-1111-4111-a111-111111111111';
const otherId = '22222222-2222-4222-a222-222222222222';
function client(documents: any[], chunks: any[] = []) {
  const reads = jest.fn();
  return { reads, db: { from: (table: string) => {
    reads(table);
    let filters: any = {};
    const query: any = {
      select: () => query, order: () => query,
      in: (key: string, value: unknown) => { filters[key] = value; return query; },
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      range: async (from: number, to: number) => ({ data: chunks.slice(from, to + 1), error: null }),
      then: (resolve: any) => resolve({ data: documents.filter(doc => doc.uploaded_by === filters.uploaded_by && filters.id.includes(doc.id)), error: null }),
    }; return query;
  } } as any };
}
const document = { id, uploaded_by: 'owner', file_name: 'curriculum.txt', status: 'completed' };
it('supplies actual attachment text with its source label', async () => {
  const { db } = client([document], [{ document_id: id, content: 'The learner must explain photosynthesis.' }]);
  expect(await attachmentContext(db, 'owner', [id])).toContain('The learner must explain photosynthesis.');
});
it('does not read chunks for another owner or a missing attachment', async () => {
  const { db, reads } = client([document]);
  await expect(attachmentContext(db, 'intruder', [id])).rejects.toMatchObject({ status: 403 });
  expect(reads).not.toHaveBeenCalledWith('document_chunks');
});
it.each([['queued',409], ['processing',409], ['error',422]])('reports %s instead of pretending to read the file', async (status, code) => {
  const { db, reads } = client([{ ...document, status }]);
  await expect(attachmentContext(db, 'owner', [id])).rejects.toMatchObject({ status: code });
  expect(reads).not.toHaveBeenCalledWith('document_chunks');
});
it('reads later chunk pages without silently dropping text', async () => {
  const chunks = Array.from({ length: 501 }, (_, i) => ({ document_id: id, content: `chunk-${i}` }));
  const { db } = client([document], chunks);
  expect(await attachmentContext(db, 'owner', [id])).toContain('chunk-500');
});
it('rejects unreadable or oversized sources with an explicit error', async () => {
  await expect(attachmentContext(client([document]).db, 'owner', [id])).rejects.toMatchObject({ status: 422 });
  await expect(attachmentContext(client([document], [{ document_id: id, content: 'x'.repeat(200001) }]).db, 'owner', [id])).rejects.toMatchObject({ status: 413 });
});
it('validates document IDs and deduplicates repeated references', () => {
  expect(attachmentIds([id, id, otherId])).toEqual([id, otherId]);
  expect(() => attachmentIds(['not-an-id'])).toThrow(); expect(() => attachmentIds(Array(51).fill(id))).toThrow();
});
it('keeps successful attachments for a retry after a later upload fails', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id }), { status: 202 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: otherId }), { status: 202 }));
  const uploads = new Map<string, string>();
  const files = [{ id: 'file-1', file: new File(['first'], 'first.txt') }, { id: 'file-2', file: new File(['second'], 'second.txt') }];
  await expect(uploadChatAttachments(files, [], uploads)).rejects.toThrow('Upload failed');
  await expect(uploadChatAttachments(files, [], uploads)).resolves.toEqual([id, otherId]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1]?.headers).toEqual({ 'Idempotency-Key': 'file-2' });
  fetchMock.mockRestore();
});
it('waits for every source, and surfaces processing errors before sending chat', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ documents: [{ id, status: 'error', name: 'bad.pdf' }] })));
  await expect(waitForChatAttachments([id])).rejects.toThrow('bad.pdf');
  fetchMock.mockRestore();
});
