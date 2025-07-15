export type ToolCategory = 
  | 'content-creation' 
  | 'assessment' 
  | 'planning' 
  | 'communication' 
  | 'differentiation'
  | 'visual-aids';

export type ToolComplexity = 'simple' | 'intermediate' | 'advanced';

export type ToolOutputFormat = 'pdf' | 'docx' | 'html' | 'json' | 'csv' | 'image' | 'text' | 'audio' | 'mp3';

export interface ToolInputField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'range';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: any;
  description?: string;
}

export interface TeachingTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string; // Icon name from lucide-react
  complexity: ToolComplexity;
  estimatedTime: string; // e.g., "2-3 minutes"
  outputFormats: ToolOutputFormat[];
  keywords?: string[];
  inputFields: ToolInputField[];
  examples?: string[];
  tips?: string[];
  apiEndpoint: string;
  isPopular?: boolean;
  isNew?: boolean;
}

// Teacher Tool Library Types
export interface TeacherToolCreation {
  id: string;
  user_id: string;
  tool_id: string;
  tool_name: string;
  title: string;
  description?: string;
  content: string | ToolCreationContent; // Allow both string and complex content
  metadata: ToolCreationMetadata;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherToolCreationInput {
  tool_id: string;
  tool_name: string;
  title: string;
  description?: string;
  content: string | ToolCreationContent; // Allow both string and complex content
  metadata?: ToolCreationMetadata;
  tags?: string[];
}

// Content types for different tools
export type ToolCreationContent = 
  | RubricContent
  | MindMapContent
  | QuizContent
  | LessonPlanContent
  | ReportCommentsContent
  | IEPContent
  | MultipleExplanationsContent
  | LessonHooksContent
  | ContentLevelerContent
  | BrainBytesContent;

// Individual tool content interfaces
export interface RubricContent {
  type: 'rubric';
  title: string;
  criteria: Array<{
    name: string;
    levels: Array<{
      level: string;
      points: number;
      description: string;
    }>;
  }>;
  totalPoints: number;
  performanceLevels: Array<{
    name: string;
    pointRange: string;
  }>;
}

export interface MindMapContent {
  type: 'mindmap';
  centralTopic: string;
  branches: Array<{
    id: string;
    label: string;
    description?: string;
    color: string;
    x: number;
    y: number;
    level: number;
    parentId?: string;
    isExpanded: boolean;
    children?: MindMapContent['branches'];
  }>;
}

export interface QuizContent {
  type: 'quiz';
  title: string;
  questions: Array<{
    id: string;
    type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank' | 'matching';
    question: string;
    options?: string[];
    correctAnswer: string | string[];
    explanation?: string;
    points: number;
  }>;
  totalPoints: number;
  answerKey: boolean;
}

export interface LessonPlanContent {
  type: 'lesson-plan';
  title: string;
  duration: string;
  objectives: string[];
  materials: string[];
  activities: Array<{
    name: string;
    duration: string;
    description: string;
    type: 'introduction' | 'instruction' | 'practice' | 'assessment' | 'closure';
  }>;
  assessment: string;
  homework?: string;
}

export interface ReportCommentsContent {
  type: 'report-comments';
  subject: string;
  performanceLevel: string;
  comments: Array<{
    type: 'strength' | 'growth' | 'general';
    text: string;
    tone: string;
  }>;
}

export interface IEPContent {
  type: 'iep';
  studentInfo: {
    age: number;
    gradeLevel: string;
    disabilityCategory: string;
  };
  goals: Array<{
    area: string;
    currentLevel: string;
    goal: string;
    objectives: string[];
    criteria: string;
    timeline: string;
  }>;
  accommodations: string[];
  services: string[];
}

export interface MultipleExplanationsContent {
  type: 'multiple-explanations';
  concept: string;
  explanations: Array<{
    type: 'visual' | 'analogy' | 'step-by-step' | 'real-world' | 'hands-on' | 'story';
    title: string;
    content: string;
    targetLearners: string[];
  }>;
}

export interface LessonHooksContent {
  type: 'lesson-hooks';
  topic: string;
  hooks: Array<{
    type: 'question' | 'fact' | 'story' | 'video' | 'activity' | 'game' | 'mystery';
    title: string;
    content: string;
    duration: string;
    materials?: string[];
  }>;
}

export interface ContentLevelerContent {
  type: 'content-leveler';
  originalLevel: string;
  targetLevel: string;
  versions: Array<{
    level: string;
    title: string;
    content: string;
    vocabulary: string[];
    supports: string[];
  }>;
}

export interface BrainBytesContent {
  type: 'brain-bytes';
  topic: string;
  bytes: Array<{
    id: string;
    title: string;
    keyConceptt: string;
    details: string[];
    memoryHook: string;
  }>;
  teachingTips: {
    gradeLevel: string;
    timing: string;
    sequence: string[];
    assessmentIdeas: string[];
  };
}

// Metadata interface
export interface ToolCreationMetadata {
  gradeLevel?: string;
  subject?: string;
  duration?: string;
  difficulty?: string;
  standards?: string[];
  learningObjectives?: string[];
  wordCount?: number;
  estimatedTime?: string;
  [key: string]: any; // Allow additional metadata
}

// Library view and filter types
export interface ToolLibraryFilters {
  toolId?: string;
  search?: string;
  tags?: string[];
  gradeLevel?: string;
  subject?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  favorites?: boolean;
}

export interface ToolLibrarySort {
  field: 'created_at' | 'updated_at' | 'title' | 'tool_name';
  direction: 'asc' | 'desc';
}

export interface ToolLibraryView {
  creations: TeacherToolCreation[];
  totalCount: number;
  hasMore: boolean;
  filters: ToolLibraryFilters;
  sort: ToolLibrarySort;
} 