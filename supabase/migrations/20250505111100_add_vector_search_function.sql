-- Create a vector similarity search function
CREATE OR REPLACE FUNCTION vector_search(
  query_embedding VECTOR(1536),
  organisation_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  content TEXT,
  metadata JSONB,
  chunk_index INTEGER,
  document_id UUID,
  file_name TEXT,
  file_type TEXT,
  document_metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.content,
    dc.metadata,
    dc.chunk_index,
    dc.document_id,
    d.file_name,
    d.file_type,
    d.metadata AS document_metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM
    document_chunks dc
  JOIN
    documents d ON dc.document_id = d.id
  WHERE
    dc.organisation_id = vector_search.organisation_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$; 