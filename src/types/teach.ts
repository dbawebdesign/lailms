import { Database } from '../../packages/types/db';

// Extract table types from database schema
type BaseClassRow = Database['public']['Tables']['base_classes']['Row'];
type ClassInstanceRow = Database['public']['Tables']['class_instances']['Row'];

// Base class types
export interface BaseClass extends BaseClassRow {
  // Add any additional computed fields that might be used in the frontend
  subject?: string;
  gradeLevel?: string;
  lengthInWeeks?: number;
}

export interface BaseClassCreationData {
  name: string;
  description?: string;
  organisation_id: string;
  settings?: any;
  lengthInWeeks?: number;
  subject?: string;
  gradeLevel?: string;
}

// Class instance types
export interface ClassInstance extends ClassInstanceRow {
  // Add any additional computed fields that might be used in the frontend
  base_class?: BaseClass;
}

export interface ClassInstanceCreationData {
  name: string;
  base_class_id: string;
  start_date?: string;
  end_date?: string;
  settings?: any;
}

export interface EnrichedClassInstance extends ClassInstance {
  base_class: BaseClass;
  student_count?: number;
  instructor_count?: number;
}

// Course generation types
export interface GeneratedOutline {
  title: string;
  description?: string;
  paths?: {
    title: string;
    description?: string;
    lessons?: {
      title: string;
      description?: string;
      sections?: {
        title: string;
        content?: string;
        section_type?: string;
      }[];
    }[];
  }[];
}

// Lesson section version (used by teachService)
export interface LessonSectionVersion {
  id: string;
  lesson_section_id: string;
  content: any;
  member_id: string | null;
  created_at: string;
  version_number: number;
}

// Re-export commonly used types from lesson.ts for convenience
export type { 
  StudioBaseClass, 
  Path, 
  Lesson, 
  LessonSection,
  Question,
  Assessment,
  AssessmentConfig,
  QuestionType,
  AssessmentType
} from './lesson'; 