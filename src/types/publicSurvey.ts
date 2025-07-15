export interface PublicSurveySection {
  id: number;
  title: string;
  description?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSurveyQuestion {
  id: number;
  section_id: number;
  question_text: string;
  question_type: 'likert' | 'multiple_choice' | 'numerical' | 'scale' | 'text';
  options: {
    scale?: string[];
    options?: string[];
    multiple?: boolean;
    type?: string;
    placeholder?: string;
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
  };
  required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSurveyResponse {
  id: number;
  session_id: string;
  email?: string;
  completed_at: string;
  duration_seconds: number;
  device_info: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicSurveyQuestionResponse {
  id: number;
  response_id: number;
  question_id: number;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface PublicSurveyQuestionSubmission {
  question_id: number;
  answer: string;
}

export interface PublicSurveySubmissionData {
  responses: PublicSurveyQuestionSubmission[];
  duration?: number;
  deviceInfo?: any;
  email?: string;
}

export interface PublicSurveyStats {
  total_responses: number;
  completed_today: number;
  avg_duration_minutes: number;
  completion_rate: number;
} 