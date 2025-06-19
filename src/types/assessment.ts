export type AssessmentStatus = 'draft' | 'published' | 'archived' | 'completed';
export type AssessmentType = 'quiz' | 'test' | 'exam' | 'practice' | 'survey';

export interface Assessment {
  id: string;
  base_class_id: string;
  title: string;
  description?: string;
  type: AssessmentType;
  status: AssessmentStatus;
  
  settings?: {
    time_limit_minutes?: number;
    shuffle_questions?: boolean;
    shuffle_options?: boolean;
    passing_score?: number;
    max_attempts?: number;
    show_correct_answers?: 'immediately' | 'after_deadline' | 'never';
    availability_start?: string;
    availability_end?: string;
  };
  
  question_ids?: string[];
  
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AssessmentSubmission {
  id: string;
  assessment_id: string;
  student_id: string;
  status: 'in_progress' | 'submitted' | 'graded';
  score?: number;
  started_at: string;
  completed_at?: string;
  answers: {
    question_id: string;
    answer: any;
  }[];
}
