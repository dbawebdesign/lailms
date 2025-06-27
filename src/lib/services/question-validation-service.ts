// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from 'packages/types/db';

type Question = Database['public']['Tables']['questions']['Row'] & {
  options: Database['public']['Tables']['question_options']['Row'][];
};

interface StudentResponse {
  questionId: string;
  questionType: string;
  studentAnswer: any;
}

interface ValidationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  detailedFeedback?: string;
  gradingNotes?: string;
}

export class QuestionValidationService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async validateAnswer(question: Question, response: StudentResponse): Promise<ValidationResult> {
    const maxScore = question.points ?? 1;

    switch (question.question_type) {
      case 'multiple_choice':
      case 'true_false':
        return this.validateMultipleChoice(question, response, maxScore);
      case 'short_answer':
        return this.validateShortAnswer(question, response, maxScore);
      case 'essay':
        return this.validateEssay(question, response, maxScore);
      default:
        return {
          isCorrect: false,
          score: 0,
          maxScore,
          feedback: 'Unsupported question type.',
          gradingNotes: 'Unsupported question type.',
        };
    }
  }

  private validateMultipleChoice(question: Question, response: StudentResponse, maxScore: number): ValidationResult {
    const correctOption = question.options.find(opt => opt.is_correct);
    const isCorrect = correctOption ? String(correctOption.id) === String(response.studentAnswer) : false;
    
    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      feedback: isCorrect ? 'Correct!' : 'Incorrect. Please review the material.',
    };
  }
  
  private async validateShortAnswer(question: Question, response: StudentResponse, maxScore: number): Promise<ValidationResult> {
    // For now, simple keyword matching. This can be expanded with AI.
    const acceptableAnswers = question.correct_answer ? String(question.correct_answer).toLowerCase().split('|') : [];
    const studentAnswerLower = String(response.studentAnswer).toLowerCase();

    const isCorrect = acceptableAnswers.some(ans => studentAnswerLower.includes(ans.trim()));

    return {
      isCorrect,
      score: isCorrect ? maxScore : 0,
      maxScore,
      feedback: isCorrect ? 'Correct!' : 'Your answer is not quite right. Please try again.',
      detailedFeedback: `Your answer: "${response.studentAnswer}". Acceptable answers include keywords like: ${acceptableAnswers.join(', ')}`,
    };
  }
  
  private async validateEssay(question: Question, response: StudentResponse, maxScore: number): Promise<ValidationResult> {
    // Essays require manual or AI grading.
    // This implementation marks it for review.
    return {
      isCorrect: false, // Pending review
      score: 0, // Pending review
      maxScore,
      feedback: 'Your essay has been submitted and will be graded separately.',
      gradingNotes: 'Requires manual grading.',
    };
  }
}
 