-- Ensure the pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

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
    public.document_chunks dc
  JOIN
    public.documents d ON dc.document_id = d.id
  WHERE
    dc.organisation_id = vector_search.organisation_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- Create an enhanced vector similarity search function with base class filtering
CREATE OR REPLACE FUNCTION vector_search_with_base_class(
  query_embedding VECTOR(1536),
  organisation_id UUID,
  base_class_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  content TEXT,
  chunk_summary TEXT,
  section_identifier TEXT,
  section_summary TEXT,
  citation_key TEXT,
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
    dc.id,
    dc.content,
    dc.chunk_summary,
    dc.section_identifier,
    dc.section_summary,
    dc.citation_key,
    dc.metadata,
    dc.chunk_index,
    dc.document_id,
    d.file_name,
    d.file_type,
    d.metadata AS document_metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM
    public.document_chunks dc
  JOIN
    public.documents d ON dc.document_id = d.id
  WHERE
    dc.organisation_id = vector_search_with_base_class.organisation_id
    AND d.base_class_id = vector_search_with_base_class.base_class_id
    AND d.status = 'completed'
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- Create an optimized function for lesson content generation that prioritizes summaries
CREATE OR REPLACE FUNCTION vector_search_for_lesson_generation(
  query_embedding VECTOR(1536),
  organisation_id UUID,
  base_class_id UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 15
) RETURNS TABLE (
  id UUID,
  content TEXT,
  chunk_summary TEXT,
  section_identifier TEXT,
  section_summary TEXT,
  citation_key TEXT,
  metadata JSONB,
  chunk_index INTEGER,
  document_id UUID,
  file_name TEXT,
  file_type TEXT,
  document_metadata JSONB,
  similarity FLOAT,
  has_summary BOOLEAN,
  content_length INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    CASE 
      WHEN dc.chunk_summary IS NOT NULL AND LENGTH(dc.chunk_summary) > 50 
      THEN dc.chunk_summary 
      ELSE dc.content 
    END AS content,
    dc.chunk_summary,
    dc.section_identifier,
    dc.section_summary,
    dc.citation_key,
    dc.metadata,
    dc.chunk_index,
    dc.document_id,
    d.file_name,
    d.file_type,
    d.metadata AS document_metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    (dc.chunk_summary IS NOT NULL AND LENGTH(dc.chunk_summary) > 50) AS has_summary,
    LENGTH(dc.content) AS content_length
  FROM
    public.document_chunks dc
  JOIN
    public.documents d ON dc.document_id = d.id
  WHERE
    dc.organisation_id = vector_search_for_lesson_generation.organisation_id
    AND d.base_class_id = vector_search_for_lesson_generation.base_class_id
    AND d.status = 'completed'
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC,
    has_summary DESC,  -- Prioritize chunks with summaries
    content_length ASC -- Prefer shorter, more focused content
  LIMIT
    match_count;
END;
$$; 