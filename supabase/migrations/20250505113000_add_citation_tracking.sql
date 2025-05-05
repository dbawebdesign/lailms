-- Add reference tracking fields to document_chunks
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS citation_key TEXT,
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS paragraph_number INTEGER;

-- Create a generations table to track user queries and responses
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add row level security to generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Create policies for generations
CREATE POLICY "Users can view their own generations" 
  ON generations FOR SELECT
  USING (user_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM organisation_members 
           WHERE organisation_members.user_id = auth.uid() 
           AND organisation_members.organisation_id = generations.organisation_id
         ));

CREATE POLICY "Users can insert their own generations" 
  ON generations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create a citations junction table for tracking used sources
CREATE TABLE IF NOT EXISTS generation_citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  relevance_score FLOAT,
  context_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add row level security to generation_citations
ALTER TABLE generation_citations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow viewing citations based on generation access
CREATE POLICY "Users can view citations for accessible generations"
  ON generation_citations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM generations
    WHERE generations.id = generation_citations.generation_id
    AND (generations.user_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM organisation_members 
           WHERE organisation_members.user_id = auth.uid() 
           AND organisation_members.organisation_id = generations.organisation_id
         ))
  ));

-- Index for quick citation lookups
CREATE INDEX IF NOT EXISTS idx_generation_citations_generation_id ON generation_citations(generation_id);
CREATE INDEX IF NOT EXISTS idx_generation_citations_chunk_id ON generation_citations(chunk_id);

-- Generate citation keys for existing chunks based on document title
UPDATE document_chunks
SET citation_key = 
  SUBSTRING(
    COALESCE(
      (metadata->>'documentTitle')::TEXT, 
      'Document-' || document_id
    ) FROM 1 FOR 20
  ) || '-' || chunk_index
WHERE citation_key IS NULL; 