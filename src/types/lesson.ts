export interface LessonSectionContent {
  text?: string; // The main educational content for students
  knowledge_base_integration?: {
    references?: any[];
    relevant_documents?: any[];
    search_queries_used?: string[];
    generation_timestamp?: string;
  };
  // Support for TipTap JSON structure
  type?: string;
  content?: any[];
}

export interface LessonSection {
  id: string;
  lesson_id: string;
  title: string;
  section_type: string; // e.g., 'text-editor', 'video', 'quiz', 'image'
  content: LessonSectionContent | any; // Structured content or TipTap JSON
  media_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null; // FK to members.id in schema
}

export interface LessonSectionVersion {
  id: string; 
  lesson_section_id: string; 
  content: any; 
  member_id: string | null; // FK to members.id in DB schema for lesson_section_versions
  created_at: string; 
  version_number: number;
}

export interface Lesson {
  id: string;
  path_id: string;
  base_class_id: string | null; // From schema, allows lesson to be optionally linked directly to base_class
  title: string;
  description: string | null;
  level: string | null;
  banner_image: string | null;
  order_index: number;
  published: boolean | null;
  estimated_time: number | null;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null; // FK to members.id in schema
  creator_user_id: string | null;    // FK to auth.users.id in schema
  sections?: LessonSection[]; // For holding fetched sections for UI
}

export interface Path {
  id: string;
  organisation_id: string;
  base_class_id: string;
  title: string;
  description: string | null;
  banner_image: string | null;
  level: string | null;
  published: boolean | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null; // FK to members.id in schema
  creator_user_id: string | null;    // FK to auth.users.id in schema
  lessons?: Lesson[]; // For holding fetched lessons for UI
}

export interface StudioBaseClass {
  id: string;
  organisation_id: string;
  name: string;
  description: string | null;
  settings: any | null; // JSONB in schema
  created_at: string;
  updated_at: string;
  user_id: string | null; // FK to profiles.user_id (which is auth.users.id)
  paths?: Path[]; // For holding fetched paths for UI
} 