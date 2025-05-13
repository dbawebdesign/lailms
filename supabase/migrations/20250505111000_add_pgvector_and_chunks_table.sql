-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  chunk_index INTEGER NOT NULL, -- Position of chunk in the document
  content TEXT NOT NULL, -- The actual text content of the chunk
  embedding VECTOR(1536), -- Vector embedding (1536 dimensions for OpenAI's text-embedding-3-small)
  token_count INTEGER NOT NULL, -- Store token count for each chunk
  metadata JSONB, -- Additional metadata about the chunk
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a GIN index on the document_id for faster lookups
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- Create a GIN index on the organisation_id for tenant isolation
CREATE INDEX IF NOT EXISTS document_chunks_organisation_id_idx ON document_chunks(organisation_id);

-- Create a vector index on the embedding column for similarity searches
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100); -- Adjust lists parameter based on expected data size

-- Set up RLS policies for document chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it exists before creating it (idempotency)
DROP POLICY IF EXISTS "Users can access chunks from their organization" ON document_chunks;

-- Create policy for chunk access - users can access chunks from their organization via profiles table
CREATE POLICY "Users can access chunks from their organization" 
  ON document_chunks 
  FOR SELECT 
  USING (
    organisation_id IN (
      SELECT organisation_id FROM public.profiles -- Changed to profiles
      WHERE user_id = auth.uid() -- Changed to user_id
    )
  );

-- Drop the service role policy if it exists before creating it (idempotency)
DROP POLICY IF EXISTS "Service role can access all chunks" ON document_chunks;

-- Allow service role to access all chunks
CREATE POLICY "Service role can access all chunks" 
  ON document_chunks 
  FOR ALL 
  TO service_role
  USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_chunks_timestamp
BEFORE UPDATE ON document_chunks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 