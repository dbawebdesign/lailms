import { SupabaseClient } from '@supabase/supabase-js';

export interface QuestionResponse {
  questionId: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  studentAnswer: string | string[] | boolean;
  timeSpent?: number;
  attemptId?: string;
}

export interface ValidationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  detailedFeedback?: string;
  partialCredit?: number;
  gradingNotes?: string;
}

export interface QuestionData {
  id: string;
  question_text: string;
  question_type: string;
  correct_answer: string;
  points: number;
  explanation?: string;
  metadata?: {
    grading_criteria?: string;
    acceptable_variations?: string[];
    case_sensitive?: boolean;
    partial_credit_enabled?: boolean;
  };
  options?: Array<{
    id: string;
    option_text: string;
    is_correct: boolean;
    order_index: number;
  }>;
}

export class QuestionValidationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Validate a student's answer to a question
   */
  async validateAnswer(
    questionData: QuestionData,
    response: QuestionResponse
  ): Promise<ValidationResult> {
    try {
      switch (questionData.question_type) {
        case 'multiple_choice':
          return this.validateMultipleChoice(questionData, response);
        
        case 'true_false':
          return this.validateTrueFalse(questionData, response);
        
        case 'short_answer':
          return this.validateShortAnswer(questionData, response);
        
        case 'essay':
          return this.validateEssay(questionData, response);
        
        default:
          throw new Error(`Unsupported question type: ${questionData.question_type}`);
      }
    } catch (error) {
      console.error('Error validating answer:', error);
      return {
        isCorrect: false,
        score: 0,
        maxScore: questionData.points,
        feedback: 'Error processing your answer. Please try again.',
        gradingNotes: `Validation error: ${error}`
      };
    }
  }

  /**
   * Validate multiple choice answer
   */
  private validateMultipleChoice(
    questionData: QuestionData,
    response: QuestionResponse
  ): ValidationResult {
    const studentAnswer = response.studentAnswer as string;
    const correctOption = questionData.options?.find(opt => opt.is_correct);
    
    if (!correctOption) {
      return {
        isCorrect: false,
        score: 0,
        maxScore: questionData.points,
        feedback: 'Question configuration error. Please contact your instructor.',
        gradingNotes: 'No correct option found in question data'
      };
    }

    const isCorrect = studentAnswer === correctOption.option_text || 
                     studentAnswer === correctOption.id;

    return {
      isCorrect,
      score: isCorrect ? questionData.points : 0,
      maxScore: questionData.points,
      feedback: isCorrect 
        ? '✅ Correct! ' + (questionData.explanation || 'Well done!')
        : '❌ Incorrect. ' + (questionData.explanation || `The correct answer is: ${correctOption.option_text}`),
      detailedFeedback: questionData.explanation
    };
  }

  /**
   * Validate true/false answer
   */
  private validateTrueFalse(
    questionData: QuestionData,
    response: QuestionResponse
  ): ValidationResult {
    const studentAnswer = String(response.studentAnswer).toLowerCase();
    const correctAnswer = questionData.correct_answer.toLowerCase();
    
    const isCorrect = studentAnswer === correctAnswer;

    return {
      isCorrect,
      score: isCorrect ? questionData.points : 0,
      maxScore: questionData.points,
      feedback: isCorrect 
        ? '✅ Correct! ' + (questionData.explanation || 'Well done!')
        : `❌ Incorrect. The correct answer is: ${correctAnswer === 'true' ? 'True' : 'False'}. ${questionData.explanation || ''}`,
      detailedFeedback: questionData.explanation
    };
  }

  /**
   * Validate short answer with fuzzy matching and acceptable variations
   */
  private validateShortAnswer(
    questionData: QuestionData,
    response: QuestionResponse
  ): ValidationResult {
    const studentAnswer = String(response.studentAnswer).trim();
    const correctAnswer = questionData.correct_answer;
    const acceptableVariations = questionData.metadata?.acceptable_variations || [];
    const caseSensitive = questionData.metadata?.case_sensitive || false;
    const partialCreditEnabled = questionData.metadata?.partial_credit_enabled || true;

    // Normalize answers for comparison
    const normalizeAnswer = (answer: string) => {
      let normalized = answer.trim();
      if (!caseSensitive) {
        normalized = normalized.toLowerCase();
      }
      // Remove extra whitespace
      normalized = normalized.replace(/\s+/g, ' ');
      return normalized;
    };

    const normalizedStudentAnswer = normalizeAnswer(studentAnswer);
    const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
    const normalizedVariations = acceptableVariations.map(normalizeAnswer);

    // Check exact match
    if (normalizedStudentAnswer === normalizedCorrectAnswer ||
        normalizedVariations.includes(normalizedStudentAnswer)) {
      return {
        isCorrect: true,
        score: questionData.points,
        maxScore: questionData.points,
        feedback: '✅ Correct! ' + (questionData.explanation || 'Well done!'),
        detailedFeedback: questionData.explanation
      };
    }

    // Check partial credit if enabled
    if (partialCreditEnabled) {
      const similarity = this.calculateStringSimilarity(
        normalizedStudentAnswer,
        normalizedCorrectAnswer
      );

      // Award partial credit for answers that are 70% similar or more
      if (similarity >= 0.7) {
        const partialScore = Math.round(questionData.points * similarity);
        return {
          isCorrect: false,
          score: partialScore,
          maxScore: questionData.points,
          partialCredit: similarity,
          feedback: `⚠️ Partially correct (${Math.round(similarity * 100)}% match). ${questionData.explanation || ''}`,
          detailedFeedback: `Expected: ${correctAnswer}. Your answer shows understanding but could be more precise.`
        };
      }
    }

    return {
      isCorrect: false,
      score: 0,
      maxScore: questionData.points,
      feedback: `❌ Incorrect. ${questionData.explanation || `Expected answer: ${correctAnswer}`}`,
      detailedFeedback: questionData.explanation
    };
  }

  /**
   * Validate essay answer (requires manual grading but provides initial feedback)
   */
  private validateEssay(
    questionData: QuestionData,
    response: QuestionResponse
  ): ValidationResult {
    const studentAnswer = String(response.studentAnswer).trim();
    const wordCount = studentAnswer.split(/\s+/).length;
    const gradingCriteria = questionData.metadata?.grading_criteria || '';

    // Basic validation checks
    if (studentAnswer.length < 50) {
      return {
        isCorrect: false,
        score: 0,
        maxScore: questionData.points,
        feedback: '⚠️ Your response appears too short. Please provide a more detailed answer.',
        detailedFeedback: 'Essay responses should be comprehensive and address all aspects of the question.',
        gradingNotes: `Word count: ${wordCount} (likely insufficient)`
      };
    }

    // For essays, we typically require manual grading
    return {
      isCorrect: false, // Will be updated by manual grading
      score: 0, // Will be updated by manual grading
      maxScore: questionData.points,
      feedback: '📝 Your essay has been submitted and will be reviewed by your instructor.',
      detailedFeedback: gradingCriteria ? `Grading criteria: ${gradingCriteria}` : undefined,
      gradingNotes: `Essay submitted. Word count: ${wordCount}. Requires manual grading.`
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    const distance = matrix[len1][len2];
    return (maxLen - distance) / maxLen;
  }

  /**
   * Save assessment response to database
   */
  async saveAssessmentResponse(
    response: QuestionResponse,
    validationResult: ValidationResult,
    userId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('assessment_responses')
        .insert({
          attempt_id: response.attemptId,
          question_id: response.questionId,
          question_type: response.questionType,
          selected_options: Array.isArray(response.studentAnswer) 
            ? response.studentAnswer 
            : [String(response.studentAnswer)],
          text_response: String(response.studentAnswer),
          is_correct: validationResult.isCorrect,
          points_awarded: validationResult.score,
          time_spent: response.timeSpent || 0,
          metadata: {
            validation_result: validationResult,
            submitted_at: new Date().toISOString(),
            user_id: userId
          }
        });

      if (error) {
        console.error('Error saving assessment response:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to save assessment response:', error);
      throw error;
    }
  }

  /**
   * Format question for UI display
   */
  formatQuestionForUI(questionData: QuestionData): any {
    const baseQuestion = {
      id: questionData.id,
      question: questionData.question_text,
      type: questionData.question_type,
      points: questionData.points,
      estimatedTime: questionData.metadata?.estimated_time || 3
    };

    switch (questionData.question_type) {
      case 'multiple_choice':
        return {
          ...baseQuestion,
          options: questionData.options?.map(opt => ({
            id: opt.id,
            text: opt.option_text,
            value: opt.option_text
          })) || []
        };

      case 'true_false':
        return {
          ...baseQuestion,
          options: [
            { id: 'true', text: 'True', value: 'true' },
            { id: 'false', text: 'False', value: 'false' }
          ]
        };

      case 'short_answer':
        return {
          ...baseQuestion,
          placeholder: 'Enter your answer here...',
          maxLength: 500,
          gradingHint: questionData.metadata?.grading_criteria
        };

      case 'essay':
        return {
          ...baseQuestion,
          placeholder: 'Write your essay response here...',
          minLength: 50,
          maxLength: 2000,
          gradingCriteria: questionData.metadata?.grading_criteria
        };

      default:
        return baseQuestion;
    }
  }
}
 