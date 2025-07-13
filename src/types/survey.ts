export interface SurveySection {
  id: number;
  title: string;
  description?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
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

export interface SurveyResponse {
  id: number;
  user_id: string;
  completed_at: string;
  duration_seconds: number;
  device_info: any;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestionResponse {
  id: number;
  survey_response_id: number;
  question_id: number;
  response_value: string;
  response_text?: string;
  created_at: string;
  updated_at: string;
}

export interface SurveySubmissionData {
  responses: Record<string, any>;
  duration: number;
  deviceInfo: any;
} 