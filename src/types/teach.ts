export interface BaseClass {
  id: string;
  name: string;
  description?: string; // Optional
  subject?: string;     // Optional
  gradeLevel?: string;  // Optional
  lengthInWeeks: number; // e.g., 1 to 52
  creationDate: string;  // ISO date string
  settings?: {
    generatedOutline?: GeneratedOutline;
    subject?: string;
    gradeLevel?: string;
    lengthInWeeks?: number;
    [key: string]: any; // Allows for other arbitrary settings
  };
  organisation_id: string; // Changed to non-optional
  created_by?: string; // Assuming this might store auth.uid()
  // Add other relevant fields later, e.g., status (active, archived)
}

export interface BaseClassCreationData extends Omit<BaseClass, 'id' | 'creationDate' | 'lengthInWeeks'> {
  lengthInWeeks: number;
  settings?: {
    generatedOutline?: GeneratedOutline;
    subject?: string;
    gradeLevel?: string;
    [key: string]: any;
  };
}

export interface ClassInstance {
  id: string;
  baseClassId: string;
  name: string; // e.g., "Spring 2024 - Section A", "Period 3 Class"
  enrollmentCode: string;
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
  period?: string;    // e.g., "Period 3", "Mon/Wed/Fri 10:00 AM"
  capacity?: number;
  status: "active" | "archived" | "upcoming" | "completed";
  creationDate: string; // ISO date string
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  // studentCount?: number; // Could be added later
}

export interface ClassInstanceCreationData extends Omit<ClassInstance, "id" | "enrollmentCode" | "creationDate" | "status" | "createdAt" | "updatedAt"> {
  // baseClassId is already part of Omit, but explicitly stating it is fine if needed for clarity
  // status will likely be set server-side or defaulted to 'upcoming'/'active'
}

// Basic placeholder interfaces for content structure - to be expanded later
export interface Path {
  id: string;
  baseClassId: string;
  title: string;
  description?: string;
  // order?: number;
}

export interface Lesson {
  id: string;
  baseClassId: string; // or pathId if lessons belong to paths
  title: string;
  description?: string;
  // content?: any; // To be defined: Rich text, video links, etc.
  // order?: number;
}

export interface Quiz {
  id: string;
  baseClassId: string; // or lessonId if quizzes are tied to lessons
  title: string;
  description?: string;
  // questions?: any[]; // To be defined
  // order?: number;
}

// New type for the AllInstancesTable
export interface EnrichedClassInstance extends ClassInstance {
  baseClassName: string;
  baseClassSubject?: string; // Optional, if you want to show subject from base class
  // studentCount?: number; // Placeholder for future data
}

// Represents the structure of a lesson section, aligning with the database and API
export interface LessonSection {
  id: string; // UUID
  lesson_id: string; // UUID, Foreign key to lessons table
  title: string;
  content: any; // JSONB from Tiptap, Prisma typically maps this to `JsonValue` or `any`
  order_index: number;
  section_type: string; // e.g., 'text-editor', 'quiz', 'video'
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  created_by: string; // UUID, Foreign key to auth.users table
}

// Represents a version of a lesson section's content
export interface LessonSectionVersion {
  id: string; // UUID
  lesson_section_id: string; // UUID, Foreign key to lesson_sections table
  content: any; // JSONB from Tiptap (the content of this specific version)
  creator_user_id: string | null; // UUID, Foreign key to auth.users table, null if user deleted
  created_at: string; // ISO date string
  version_number: number;
}

// New interfaces for defining structure from BaseClass.settings.generatedOutline
export interface GeneratedLesson {
  title: string;
  description: string;
  objective?: string;
}

export interface GeneratedModule {
  title: string;
  description: string;
  topics?: string[];
  suggestedLessons: GeneratedLesson[];
  suggestedAssessments?: any[];
}

export interface GeneratedOutline {
  modules: GeneratedModule[];
} 