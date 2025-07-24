// Study Space System Types
// Generated from Supabase schema for the study space system

export interface StudySpace {
  id: string;
  user_id: string;
  organisation_id: string;
  name: string;
  description?: string;
  color?: string;
  is_default?: boolean;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface StudyNote {
  id: string;
  study_space_id: string;
  user_id: string;
  organisation_id: string;
  title: string;
  content: Record<string, any>; // JSONB content
  content_embedding?: number[]; // Vector embedding
  tags?: string[];
  is_pinned?: boolean;
  parent_note_id?: string;
  linked_lesson_id?: string;
  linked_lesson_section_id?: string;
  linked_path_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  study_space_id: string;
  user_id: string;
  organisation_id: string;
  session_type: string;
  duration_minutes?: number;
  started_at: string;
  ended_at?: string;
  linked_lesson_id?: string;
  linked_lesson_section_id?: string;
  linked_path_id?: string;
  notes_created?: number;
  flashcards_reviewed?: number;
  bookmarks_added?: number;
  session_data?: Record<string, any>;
  quality_rating?: number;
  created_at: string;
  updated_at: string;
}

export interface StudyGoal {
  id: string;
  study_space_id: string;
  user_id: string;
  organisation_id: string;
  title: string;
  description?: string;
  goal_type: string;
  target_value: number;
  current_value?: number;
  target_date?: string;
  linked_lesson_id?: string;
  linked_path_id?: string;
  status?: string;
  completion_percentage?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface StudyContentIndex {
  id: string;
  base_class_id: string;
  organisation_id: string;
  content_type: string;
  source_table: string;
  source_id: string;
  path_id?: string;
  lesson_id?: string;
  parent_content_id?: string;
  title: string;
  description?: string;
  content_text: string;
  content_json?: Record<string, any>;
  content_embedding?: number[];
  search_keywords?: string[];
  tags?: string[];
  content_tsvector?: string; // PostgreSQL tsvector
  difficulty_level?: string;
  estimated_time?: number;
  learning_objectives?: string[];
  prerequisites?: string[];
  is_bookmarkable?: boolean;
  is_notable?: boolean;
  progress_trackable?: boolean;
  related_content_ids?: string[];
  assessment_ids?: string[];
  media_asset_ids?: string[];
  created_at: string;
  updated_at: string;
  indexed_at: string;
}

export interface StudySpaceBrainbytes {
  id: string;
  user_id: string;
  base_class_id?: string;
  study_space_id?: string;
  title: string;
  script: string;
  audio_url: string;
  instructions?: string;
  content_context?: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// Enums and Constants
export const StudySessionType = {
  READING: 'reading',
  NOTE_TAKING: 'note_taking',
  REVIEW: 'review',
  PRACTICE: 'practice',
  RESEARCH: 'research',
  DISCUSSION: 'discussion',
  ASSESSMENT: 'assessment',
} as const;

export type StudySessionTypeValue = typeof StudySessionType[keyof typeof StudySessionType];

export const StudyGoalType = {
  TIME_BASED: 'time_based',
  COMPLETION_BASED: 'completion_based',
  SCORE_BASED: 'score_based',
  STREAK_BASED: 'streak_based',
} as const;

export type StudyGoalTypeValue = typeof StudyGoalType[keyof typeof StudyGoalType];

export const StudyGoalStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type StudyGoalStatusValue = typeof StudyGoalStatus[keyof typeof StudyGoalStatus];

export const ContentType = {
  LESSON: 'lesson',
  LESSON_SECTION: 'lesson_section',
  PATH: 'path',
  ASSESSMENT: 'assessment',
  MEDIA: 'media',
  DISCUSSION: 'discussion',
  ASSIGNMENT: 'assignment',
} as const;

export type ContentTypeValue = typeof ContentType[keyof typeof ContentType];

// Utility Types for API Responses
export interface StudySpaceWithStats extends StudySpace {
  note_count?: number;
  session_count?: number;
  total_study_time?: number;
  last_activity?: string;
  active_goals?: number;
}

export interface StudyNoteWithContent extends StudyNote {
  formatted_content?: string;
  word_count?: number;
  reading_time?: number;
  related_notes?: StudyNote[];
}

export interface StudySessionWithDetails extends StudySession {
  productivity_score?: number;
  focus_periods?: number;
  break_periods?: number;
  achievements_unlocked?: string[];
}

// Form Types for Creating/Updating
export interface CreateStudySpaceData {
  name: string;
  description?: string;
  color?: string;
  settings?: Record<string, any>;
}

export interface CreateStudyNoteData {
  study_space_id: string;
  title: string;
  content: Record<string, any>;
  tags?: string[];
  parent_note_id?: string;
  linked_lesson_id?: string;
  linked_lesson_section_id?: string;
  linked_path_id?: string;
}

export interface CreateStudyGoalData {
  study_space_id: string;
  title: string;
  description?: string;
  goal_type: StudyGoalTypeValue;
  target_value: number;
  target_date?: string;
  linked_lesson_id?: string;
  linked_path_id?: string;
}

export interface StartStudySessionData {
  study_space_id: string;
  session_type: StudySessionTypeValue;
  linked_lesson_id?: string;
  linked_lesson_section_id?: string;
  linked_path_id?: string;
}

export interface CreateStudySpaceBrainbytesData {
  studyContext: {
    selectedContent: any[];
    selectedText?: {
      text: string;
      source: string;
    };
  };
  baseClassId?: string;
  studySpaceId?: string;
  instructions?: string;
  gradeLevel?: string;
}

// API Response Types
export interface StudySpaceListResponse {
  data: StudySpaceWithStats[];
  count: number;
  page?: number;
  limit?: number;
}

export interface StudyNoteListResponse {
  data: StudyNoteWithContent[];
  count: number;
  page?: number;
  limit?: number;
}

export interface StudyAnalyticsResponse {
  total_study_time: number;
  sessions_this_week: number;
  notes_created: number;
  goals_completed: number;
  average_session_duration: number;
  productivity_trend: Array<{
    date: string;
    duration: number;
    productivity_score: number;
  }>;
  top_subjects: Array<{
    subject: string;
    time_spent: number;
    note_count: number;
  }>;
  recent_achievements: string[];
} 