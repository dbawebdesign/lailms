-- Add summary-related columns to document_chunks table
ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS chunk_summary TEXT,
    ADD COLUMN IF NOT EXISTS summary_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS section TEXT,
    ADD COLUMN IF NOT EXISTS section_summary TEXT;

-- Add summary fields to documents table
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS document_summary TEXT,
    ADD COLUMN IF NOT EXISTS summary_status TEXT DEFAULT 'pending';

-- Create index on summary_status for faster queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_summary_status ON document_chunks(summary_status);
CREATE INDEX IF NOT EXISTS idx_documents_summary_status ON documents(summary_status);

-- Create section_id index for grouping chunks by section
CREATE INDEX IF NOT EXISTS idx_document_chunks_section ON document_chunks(document_id, section) WHERE section IS NOT NULL; 