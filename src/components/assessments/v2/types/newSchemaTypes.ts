/**
 * NEW ASSESSMENT SCHEMA TYPES (V2)
 * 
 * These types are specifically designed for the new 4-table assessment schema
 * and should be used for all new assessment components going forward.
 * 
 * DO NOT confuse with legacy types in src/types/assessment.ts
 */

// Core Assessment Types for New Schema
export type NewSchemaQuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching';
export type NewSchemaAssessmentType = 'lesson' | 'path' | 'class';
export type NewSchemaAttemptStatus = 'in_progress' | 'completed' | 'abandoned' | 'grading' | 'graded';
export type NewSchemaAIGradingStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'manual_override';

// New Schema Assessment Interface
export interface NewSchemaAssessment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  assessment_type: NewSchemaAssessmentType;
  base_class_id: string;
  lesson_id?: string;
  path_id?: string;
  time_limit_minutes?: number;
  max_attempts?: number;
  passing_score_percentage?: number;
  randomize_questions?: boolean;
  show_results_immediately?: boolean;
  allow_review?: boolean;
  ai_grading_enabled?: boolean;
  ai_model?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// New Schema Question Interface
export interface NewSchemaQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: NewSchemaQuestionType;
  points?: number;
  order_index: number;
  required?: boolean;
  answer_key: Record<string, any>; // JSONB field with type-specific structure
  sample_response?: string; // For AI grading (short_answer, essay)
  grading_rubric?: Record<string, any>; // JSONB field for rubric
  ai_grading_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

// Question Type Specific Structures
export interface NewSchemaMultipleChoiceAnswerKey {
  correct_answer: string; // e.g., "A"
  options: string[]; // e.g., ["Option A", "Option B", "Option C", "Option D"]
  explanations: Record<string, string>; // e.g., {"A": "Correct because...", "B": "Incorrect because..."}
}

export interface NewSchemaTrueFalseAnswerKey {
  correct_answer: boolean;
  explanation: string;
}

export interface NewSchemaShortAnswerAnswerKey {
  acceptable_answers: string[];
  keywords: string[];
  min_score_threshold: number; // 0.0 to 1.0
  grading_criteria: string;
}

export interface NewSchemaEssayAnswerKey {
  grading_criteria: string;
  key_points: string[];
  rubric: {
    [criterion: string]: {
      description: string;
      excellent: string;
      good: string;
      fair: string;
      poor: string;
      points: number;
    };
  };
  semantic_weight: number; // 0.0 to 1.0
  rubric_weight: number; // 0.0 to 1.0
}

export interface NewSchemaMatchingAnswerKey {
  pairs: Array<{
    left: string;
    right: string;
  }>;
  left_items: string[];
  right_items: string[];
}

// New Schema Student Attempt Interface
export interface NewSchemaStudentAttempt {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: NewSchemaAttemptStatus;
  started_at?: string;
  submitted_at?: string;
  time_spent_minutes?: number;
  total_points?: number;
  earned_points?: number;
  percentage_score?: number;
  passed?: boolean;
  ai_grading_status?: NewSchemaAIGradingStatus;
  ai_graded_at?: string;
  manual_review_required?: boolean;
  manually_graded_by?: string;
  manually_graded_at?: string;
  instructor_feedback?: string;
  ai_feedback?: string;
  created_at: string;
  updated_at: string;
}

// New Schema Student Response Interface
export interface NewSchemaStudentResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  response_data: Record<string, any>; // JSONB field with type-specific response
  points_earned?: number;
  is_correct?: boolean;
  ai_score?: number;
  ai_feedback?: string;
  ai_confidence?: number;
  ai_graded_at?: string;
  manual_score?: number;
  manual_feedback?: string;
  manually_graded_by?: string;
  manually_graded_at?: string;
  override_reason?: string;
  final_score?: number;
  final_feedback?: string;
  created_at: string;
  updated_at: string;
}

// Response Data Structures for Each Question Type
export interface NewSchemaMultipleChoiceResponse {
  selected_option: string; // e.g., "A"
}

export interface NewSchemaTrueFalseResponse {
  selected_answer: boolean;
}

export interface NewSchemaShortAnswerResponse {
  text_answer: string;
}

export interface NewSchemaEssayResponse {
  essay_text: string;
  word_count?: number;
}

export interface NewSchemaMatchingResponse {
  matches: Record<string, string>; // e.g., {"item1": "match1", "item2": "match2"}
}

// Component Props Interfaces
export interface NewSchemaQuestionProps {
  question: NewSchemaQuestion;
  currentResponse?: NewSchemaStudentResponse;
  onAnswerChange: (questionId: string, responseData: Record<string, any>) => void;
  disabled?: boolean;
  showCorrectAnswer?: boolean;
  showExplanation?: boolean;
}

export interface NewSchemaAssessmentProps {
  assessment: NewSchemaAssessment;
  questions: NewSchemaQuestion[];
  attempt?: NewSchemaStudentAttempt;
  onSubmit: (responses: Record<string, any>[]) => Promise<void>;
  onSaveDraft?: (responses: Record<string, any>[]) => Promise<void>;
  showProgress?: boolean;
  allowNavigation?: boolean;
}

// Assessment Results Interface
export interface NewSchemaAssessmentResults {
  attempt: NewSchemaStudentAttempt;
  responses: NewSchemaStudentResponse[];
  questions: NewSchemaQuestion[];
  assessment: NewSchemaAssessment;
  score_breakdown: {
    total_points: number;
    earned_points: number;
    percentage: number;
    passed: boolean;
    question_scores: Array<{
      question_id: string;
      points_possible: number;
      points_earned: number;
      is_correct: boolean;
    }>;
  };
}

// Progress Tracking Interface
export interface NewSchemaAssessmentProgress {
  current_question: number;
  total_questions: number;
  answered_questions: number;
  time_remaining_minutes?: number;
  time_elapsed_minutes: number;
  percentage_complete: number;
}

// Utility Types
export type NewSchemaAnswerKey = 
  | NewSchemaMultipleChoiceAnswerKey 
  | NewSchemaTrueFalseAnswerKey 
  | NewSchemaShortAnswerAnswerKey 
  | NewSchemaEssayAnswerKey 
  | NewSchemaMatchingAnswerKey;

export type NewSchemaResponseData = 
  | NewSchemaMultipleChoiceResponse 
  | NewSchemaTrueFalseResponse 
  | NewSchemaShortAnswerResponse 
  | NewSchemaEssayResponse 
  | NewSchemaMatchingResponse; 