type AccessClient = {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from(table: string): any;
};

/** Return an HTTP denial before any status write or external processing. */
export async function authorizeDocumentProcessing(
  client: AccessClient, documentId: string, authorization: string | null, serviceKey: string,
): Promise<401 | 403 | 404 | null> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return 401;
  if (token === serviceKey) return null;
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return 401;
  const { data: document, error: docError } = await client.from('documents')
    .select('uploaded_by, organisation_id').eq('id',documentId).single();
  if (docError || !document) return 404;
  if (document.uploaded_by === user.id) return null;
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('role, active_role, organisation_id').eq('user_id',user.id).single();
  if (profileError || !profile?.organisation_id || profile.organisation_id !== document.organisation_id
      || !['teacher','admin','super_admin'].includes(profile.active_role || profile.role)) return 403;
  return null;
}
