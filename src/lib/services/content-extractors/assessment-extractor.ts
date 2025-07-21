import { StudyContent, ContentType } from '@/types/study-content';
import { BaseContentExtractor } from './base-extractor';

export class AssessmentExtractor extends BaseContentExtractor {
  getContentType(): ContentType {
    return 'assessment';
  }

  canProcess(source: any): boolean {
    // Can process lesson assessments, path assessments, or class assessments
    return this.validateSource(source, ['id', 'title']) && 
           (source.lesson_id || source.path_id || source.base_class_id);
  }

  async extract(source: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    if (!this.canProcess(source)) {
      throw new Error(`Invalid assessment source: missing required fields`);
    }

    // Extract assessment content text
    const contentText = this.extractAssessmentContentText(source);
    
    // Create base content object
    const content = this.createBaseStudyContent(
      `assessment_${source.id}`,
      'assessment',
      this.getSourceTable(source),
      source.id,
      baseClassId,
      organisationId,
      source.title,
      contentText
    );

    // Add assessment-specific properties
    content.description = source.description;
    content.lesson_id = source.lesson_id;
    content.path_id = source.path_id;

    // Set parent content ID based on scope
    if (source.lesson_id) {
      content.parent_content_id = `lesson_${source.lesson_id}`;
    } else if (source.path_id) {
      content.parent_content_id = `module_${source.path_id}`;
    } else {
      content.parent_content_id = `course_${baseClassId}`;
    }

    // Set assessment-specific tags
    content.tags = this.formatTags([
      'assessment',
      source.assessment_type || 'quiz',
      this.getAssessmentScope(source),
      source.difficulty_level
    ]);

    // Set estimated time based on question count or provided time
    content.estimated_time = this.calculateAssessmentTime(source);

    // Assessments are always progress trackable
    content.progress_trackable = true;

    // Extract question references
    if (source.questions) {
      content.related_content_ids = source.questions.map((q: any) => `question_${q.id}`);
    }

    // Generate embedding for assessment content
    if (contentText.length > 50) {
      content.content_embedding = await this.generateEmbedding(contentText);
    }

    // Set timestamps from source
    content.created_at = source.created_at || content.created_at;
    content.updated_at = source.updated_at || content.updated_at;

    return content;
  }

  /**
   * Extract questions as individual content items
   */
  async extractQuestions(
    questions: any[],
    assessmentId: string,
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const questionContents: StudyContent[] = [];

    for (const question of questions) {
      try {
        const questionContent = await this.extractQuestion(
          question,
          assessmentId,
          baseClassId,
          organisationId
        );
        questionContents.push(questionContent);
      } catch (error) {
        console.error(`Error extracting question ${question.id}:`, error);
      }
    }

    return questionContents;
  }

  /**
   * Extract individual question as content
   */
  private async extractQuestion(
    question: any,
    assessmentId: string,
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent> {
    const questionText = this.extractQuestionText(question);
    
    const content = this.createBaseStudyContent(
      `question_${question.id}`,
      'assessment', // Questions are part of assessments
      'lesson_questions', // Assuming this is the source table
      question.id,
      baseClassId,
      organisationId,
      `Question: ${question.question_text || question.title}`,
      questionText
    );

    // Set parent as the assessment
    content.parent_content_id = `assessment_${assessmentId}`;

    // Question-specific properties
    content.tags = this.formatTags([
      'question',
      question.question_type || 'multiple_choice',
      question.difficulty_level,
      question.topic
    ]);

    // Estimated time per question (2-5 minutes depending on type)
    content.estimated_time = this.getQuestionTime(question.question_type);

    // Questions can be bookmarked and noted for study
    content.is_bookmarkable = true;
    content.is_notable = true;
    content.progress_trackable = false; // Individual questions don't track progress

    // Store question data
    content.content_json = {
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      topic: question.topic,
      difficulty_level: question.difficulty_level
    };

    return content;
  }

  /**
   * Determine source table based on assessment type
   */
  private getSourceTable(source: any): string {
    if (source.lesson_id) return 'lesson_assessments';
    if (source.path_id) return 'path_assessments';
    return 'class_assessments';
  }

  /**
   * Extract searchable text from assessment
   */
  private extractAssessmentContentText(source: any): string {
    let content = `${source.title}`;
    
    if (source.description) {
      content += `\nDescription: ${source.description}`;
    }

    if (source.instructions) {
      content += `\nInstructions: ${source.instructions}`;
    }

    // Add assessment metadata
    if (source.assessment_type) {
      content += `\nType: ${source.assessment_type}`;
    }

    if (source.time_limit) {
      content += `\nTime Limit: ${source.time_limit} minutes`;
    }

    if (source.total_points) {
      content += `\nTotal Points: ${source.total_points}`;
    }

    // Include question content if available
    if (source.questions && Array.isArray(source.questions)) {
      content += `\nQuestions (${source.questions.length}):`;
      source.questions.forEach((q: any, index: number) => {
        content += `\n${index + 1}. ${q.question_text || q.title}`;
        if (q.explanation) {
          content += ` (${q.explanation})`;
        }
      });
    }

    return content;
  }

  /**
   * Extract text content from question
   */
  private extractQuestionText(question: any): string {
    let content = question.question_text || question.title || '';

    // Add options for multiple choice questions
    if (question.options && Array.isArray(question.options)) {
      content += '\nOptions:';
      question.options.forEach((option: any, index: number) => {
        content += `\n${String.fromCharCode(65 + index)}. ${option.text || option}`;
      });
    }

    // Add explanation if available
    if (question.explanation) {
      content += `\nExplanation: ${question.explanation}`;
    }

    // Add topic/subject context
    if (question.topic) {
      content += `\nTopic: ${question.topic}`;
    }

    return content;
  }

  /**
   * Get assessment scope for tagging
   */
  private getAssessmentScope(source: any): string {
    if (source.lesson_id) return 'lesson';
    if (source.path_id) return 'module';
    return 'course';
  }

  /**
   * Calculate estimated time for assessment
   */
  private calculateAssessmentTime(source: any): number | undefined {
    // Use provided time limit if available
    if (source.time_limit) {
      return source.time_limit;
    }

    // Estimate based on question count
    if (source.questions && Array.isArray(source.questions)) {
      const questionCount = source.questions.length;
      const avgTimePerQuestion = 3; // 3 minutes per question average
      return questionCount * avgTimePerQuestion;
    }

    // Default estimates by assessment type
    const typeEstimates: Record<string, number> = {
      'quiz': 15,
      'test': 45,
      'exam': 90,
      'assignment': 120,
      'project': 240
    };

    return typeEstimates[source.assessment_type] || 30;
  }

  /**
   * Get estimated time per question type
   */
  private getQuestionTime(questionType: string): number {
    const timeMap: Record<string, number> = {
      'multiple_choice': 2,
      'true_false': 1,
      'short_answer': 5,
      'essay': 15,
      'fill_in_blank': 3,
      'matching': 4,
      'ordering': 3
    };

    return timeMap[questionType] || 3;
  }

  /**
   * Batch extract assessments with their questions
   */
  async extractAssessmentsWithQuestions(
    assessments: any[],
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const allContent: StudyContent[] = [];

    for (const assessment of assessments) {
      try {
        // Extract the assessment itself
        const assessmentContent = await this.extract(assessment, baseClassId, organisationId);
        allContent.push(assessmentContent);

        // Extract individual questions if present
        if (assessment.questions && Array.isArray(assessment.questions)) {
          const questionContents = await this.extractQuestions(
            assessment.questions,
            assessment.id,
            baseClassId,
            organisationId
          );
          allContent.push(...questionContents);
        }
      } catch (error) {
        console.error(`Error extracting assessment ${assessment.id}:`, error);
      }
    }

    return allContent;
  }
} 