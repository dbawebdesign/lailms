import { createSupabaseServerClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { Database } from '@learnologyai/types';
import { QuestionGenerationService } from './question-generation-service';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type QuestionInsert = Database['public']['Tables']['questions']['Insert'];
type QuestionType = Database['public']['Enums']['question_type'];

interface AssessmentGenerationParams {
  scope: 'lesson' | 'path' | 'class';
  scopeId: string;
  baseClassId: string;
  questionCount: number;
  assessmentTitle: string;
  questionTypes?: QuestionType[];
  onProgress?: (message: string) => void;
}

export class AssessmentGenerationService {
  private questionGenerationService: QuestionGenerationService;

  constructor() {
    this.questionGenerationService = new QuestionGenerationService();
  }

  async generateAssessment(params: AssessmentGenerationParams): Promise<Assessment> {
    const { onProgress } = params;
    const supabase = await createSupabaseServerClient();
    onProgress?.(`Starting assessment generation for ${params.scope}: ${params.scopeId}`);

    // 1. Get content for the specified scope (This is a placeholder, needs implementation)
    const content = await this.getContentForScope(params.scope, params.scopeId);
    if (!content) {
      onProgress?.(`Failed to get content for scope.`);
      throw new Error(`Could not retrieve content for ${params.scope} ${params.scopeId}`);
    }
    onProgress?.(`Retrieved content for assessment.`);
    
    // 2. Generate question data using the existing service
    const desiredQuestionTypes: QuestionType[] = params.questionTypes || ['multiple_choice', 'short_answer'];
    const generatedQuestionData = await this.questionGenerationService.generateQuestionsFromContent(
      content,
      params.questionCount,
      desiredQuestionTypes,
      params.baseClassId,
      [params.scope] // Use scope as a tag
    );

    if (generatedQuestionData.length === 0) {
      onProgress?.('Question generation failed.');
      throw new Error('Question generation service returned no questions.');
    }
    onProgress?.(`Generated ${generatedQuestionData.length} questions.`);

    // 3. Use a transaction to create the assessment and its questions
    onProgress?.('Saving assessment and questions to the database.');
    const { data: assessment, error } = await supabase.rpc('create_assessment_with_questions', {
      p_assessment_title: params.assessmentTitle,
      p_assessment_type: this.mapScopeToAssessmentType(params.scope),
      p_base_class_id: params.scope === 'class' ? params.scopeId : params.baseClassId,
      p_lesson_id: params.scope === 'lesson' ? params.scopeId : null,
      p_path_id: params.scope === 'path' ? params.scopeId : null,
      p_questions: generatedQuestionData as unknown as QuestionInsert[], // Casting needed
    });

    if (error) {
      onProgress?.(`Database error: ${error.message}`);
      console.error('Error in transaction for creating assessment:', error);
      throw new Error(`Failed to create assessment in database: ${error.message}`);
    }

    onProgress?.('Successfully created assessment.');
    console.log('Successfully created assessment and questions:', assessment);
    return assessment;
  }
  
  private mapScopeToAssessmentType(scope: 'lesson' | 'path' | 'class'): 'lesson_quiz' | 'path_exam' | 'final_exam' {
    switch (scope) {
      case 'lesson': return 'lesson_quiz';
      case 'path': return 'path_exam';
      case 'class': return 'final_exam';
    }
  }

  private async getContentForScope(scope: 'lesson' | 'path' | 'class', scopeId: string): Promise<string> {
    // TODO: Implement the logic to fetch and concatenate content
    // based on the scope.
    // For a 'lesson', get all lesson_sections.
    // For a 'path', get all content from all lessons in that path.
    // For a 'class', get all content from all documents in the base_class.
    
    console.warn(`[TBD] Fetching content for ${scope} ${scopeId}. Using placeholder content.`);
    return "Placeholder content about modern web development, React, and Next.js. This will be replaced with actual content fetching logic.";
  }
} 