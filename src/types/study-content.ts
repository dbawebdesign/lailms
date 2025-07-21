export type ContentType = 'course' | 'module' | 'lesson' | 'section' | 'media' | 'assessment' | 'document';

export interface StudyContent {
  // Identity & Classification
  id: string;
  content_type: ContentType;
  source_table: string; // original table name
  source_id: string;   // original record ID
  
  // Hierarchy & Context
  base_class_id: string;
  organisation_id: string;
  path_id?: string;
  lesson_id?: string;
  parent_content_id?: string;
  
  // Core Content
  title: string;
  description?: string;
  content_text: string;      // Extracted/processed text for search
  content_json?: any;        // Original JSONB content if applicable
  
  // Search & Discovery
  content_embedding?: number[]; // Vector embedding for semantic search
  search_keywords: string[];    // Extracted keywords for full-text search
  tags: string[];              // Content tags and categories
  
  // Metadata for Learning
  difficulty_level?: string;
  estimated_time?: number;    // in minutes
  learning_objectives?: string[];
  prerequisites?: string[];
  
  // Study Space Integration
  is_bookmarkable: boolean;
  is_notable: boolean;        // Can have study notes attached
  progress_trackable: boolean;
  
  // Relationships & Navigation
  related_content_ids: string[];  // Related/prerequisite content
  assessment_ids: string[];       // Associated assessments
  media_asset_ids: string[];      // Associated media
  
  // Timestamps & Tracking
  created_at: string;
  updated_at: string;
  indexed_at: string;
}

export interface ContentExtractionResult {
  content: StudyContent;
  relationships: {
    parent_id?: string;
    children_ids: string[];
    related_ids: string[];
  };
}

export interface ContentAggregationOptions {
  includeDocuments?: boolean;
  includeAssessments?: boolean;
  includeMediaAssets?: boolean;
  forceReindex?: boolean;
  batchSize?: number;
}

export interface ContentIndexStats {
  total_items: number;
  by_type: Record<ContentType, number>;
  last_indexed: string;
  indexing_duration_ms: number;
  errors: string[];
}

// Content extraction function signatures
export interface ContentExtractor<T = any> {
  extract(source: T): Promise<StudyContent>;
  canProcess(source: any): boolean;
  getContentType(): ContentType;
}

// Search and retrieval interfaces
export interface StudyContentSearchQuery {
  query?: string;
  content_types?: ContentType[];
  base_class_id: string;
  tags?: string[];
  difficulty_level?: string;
  limit?: number;
  offset?: number;
  include_embeddings?: boolean;
}

export interface StudyContentSearchResult {
  items: StudyContent[];
  total_count: number;
  search_time_ms: number;
  facets?: {
    content_types: Record<ContentType, number>;
    tags: Record<string, number>;
    difficulty_levels: Record<string, number>;
  };
}

// Indexing queue and status
export interface ContentIndexingJob {
  id: string;
  base_class_id: string;
  organisation_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  stats?: ContentIndexStats;
}

export interface ContentReindexQueueItem {
  source_table: string;
  source_id: string;
  base_class_id: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
} 