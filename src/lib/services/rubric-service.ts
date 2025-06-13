import { createClient } from '@/lib/supabase/client';
import { Database } from '@/lib/database.types';

type Rubric = Database['public']['Tables']['rubrics']['Row'];
type RubricInsert = Database['public']['Tables']['rubrics']['Insert'];
type RubricCriteria = Database['public']['Tables']['rubric_criteria']['Row'];
type RubricCriteriaInsert = Database['public']['Tables']['rubric_criteria']['Insert'];
type GradingSession = Database['public']['Tables']['grading_sessions']['Row'];
type GradingRecord = Database['public']['Tables']['grading_records']['Row'];

export interface PerformanceLevel {
  level: string;
  points: number;
  description: string;
  examples?: string[];
}

export interface RubricCriterion {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  maxPoints: number;
  performanceLevels: PerformanceLevel[];
  orderIndex: number;
}

export interface CreateRubricRequest {
  name: string;
  description?: string;
  baseClassId?: string;
  rubricType: 'holistic' | 'analytic' | 'checklist' | 'rating_scale';
  gradingScale: 'points' | 'percentage' | 'letter_grade' | 'pass_fail' | 'rubric_scale';
  scaleDefinition?: any;
  criteria: RubricCriterion[];
  isTemplate?: boolean;
  tags?: string[];
}

export interface GradingRequest {
  assessmentId: string;
  assessmentType: 'practice' | 'lesson_quiz' | 'path_exam' | 'final_exam' | 'diagnostic' | 'benchmark';
  gradingMethod: 'automatic' | 'manual' | 'hybrid' | 'peer_review' | 'ai_assisted';
  rubricId?: string;
}

export interface GradeResponse {
  responseId: string;
  responseType: 'assessment_response' | 'quiz_response';
  criterionId?: string;
  pointsAwarded: number;
  maxPoints: number;
  performanceLevel?: string;
  feedback?: string;
  confidenceScore?: number;
  flags?: string[];
}

export class RubricService {
  private supabase = createClient();

  /**
   * Create a new rubric with criteria
   */
  async createRubric(request: CreateRubricRequest, userId: string): Promise<{ rubric: Rubric; criteria: RubricCriteria[] }> {
    try {
      // Create the rubric
      const { data: rubric, error: rubricError } = await this.supabase
        .from('rubrics')
        .insert({
          name: request.name,
          description: request.description,
          base_class_id: request.baseClassId,
          rubric_type: request.rubricType,
          grading_scale: request.gradingScale,
          scale_definition: request.scaleDefinition,
          criteria: {}, // Will be replaced by normalized criteria
          total_points: request.criteria.reduce((sum, c) => sum + c.maxPoints, 0),
          is_template: request.isTemplate || false,
          tags: request.tags || [],
          created_by: userId
        } as RubricInsert)
        .select()
        .single();

      if (rubricError) throw rubricError;

      // Create criteria
      const criteriaInserts: RubricCriteriaInsert[] = request.criteria.map(criterion => ({
        rubric_id: rubric.id,
        name: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        max_points: criterion.maxPoints,
        performance_levels: criterion.performanceLevels,
        order_index: criterion.orderIndex
      }));

      const { data: criteria, error: criteriaError } = await this.supabase
        .from('rubric_criteria')
        .insert(criteriaInserts)
        .select();

      if (criteriaError) throw criteriaError;

      return { rubric, criteria };
    } catch (error) {
      console.error('Error creating rubric:', error);
      throw new Error('Failed to create rubric');
    }
  }

  /**
   * Get rubric with criteria
   */
  async getRubric(rubricId: string): Promise<{ rubric: Rubric; criteria: RubricCriteria[] } | null> {
    try {
      const { data: rubric, error: rubricError } = await this.supabase
        .from('rubrics')
        .select('*')
        .eq('id', rubricId)
        .single();

      if (rubricError) throw rubricError;
      if (!rubric) return null;

      const { data: criteria, error: criteriaError } = await this.supabase
        .from('rubric_criteria')
        .select('*')
        .eq('rubric_id', rubricId)
        .order('order_index');

      if (criteriaError) throw criteriaError;

      return { rubric, criteria: criteria || [] };
    } catch (error) {
      console.error('Error fetching rubric:', error);
      return null;
    }
  }

  /**
   * Get rubrics for a class
   */
  async getClassRubrics(baseClassId: string): Promise<Rubric[]> {
    try {
      const { data, error } = await this.supabase
        .from('rubrics')
        .select('*')
        .eq('base_class_id', baseClassId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching class rubrics:', error);
      return [];
    }
  }

  /**
   * Get template rubrics
   */
  async getTemplateRubrics(): Promise<Rubric[]> {
    try {
      const { data, error } = await this.supabase
        .from('rubrics')
        .select('*')
        .eq('is_template', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching template rubrics:', error);
      return [];
    }
  }

  /**
   * Start a grading session
   */
  async startGradingSession(request: GradingRequest, graderId: string): Promise<GradingSession> {
    try {
      // Get total responses to grade
      let totalResponses = 0;
      
      if (request.assessmentType === 'lesson_quiz' || request.assessmentType === 'practice') {
        const { count } = await this.supabase
          .from('assessment_responses')
          .select('*', { count: 'exact', head: true })
          .eq('attempt_id', request.assessmentId);
        totalResponses = count || 0;
      } else {
        const { count } = await this.supabase
          .from('quiz_responses')
          .select('*', { count: 'exact', head: true })
          .eq('attempt_id', request.assessmentId);
        totalResponses = count || 0;
      }

      const { data, error } = await this.supabase
        .from('grading_sessions')
        .insert({
          assessment_id: request.assessmentId,
          assessment_type: request.assessmentType,
          grader_id: graderId,
          grading_method: request.gradingMethod,
          rubric_id: request.rubricId,
          total_responses: totalResponses
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error starting grading session:', error);
      throw new Error('Failed to start grading session');
    }
  }

  /**
   * Grade responses using rubric
   */
  async gradeResponses(sessionId: string, grades: GradeResponse[]): Promise<GradingRecord[]> {
    try {
      const gradingRecords = grades.map(grade => ({
        session_id: sessionId,
        response_id: grade.responseId,
        response_type: grade.responseType,
        criterion_id: grade.criterionId,
        points_awarded: grade.pointsAwarded,
        max_points: grade.maxPoints,
        performance_level: grade.performanceLevel,
        feedback: grade.feedback,
        confidence_score: grade.confidenceScore,
        flags: grade.flags
      }));

      const { data, error } = await this.supabase
        .from('grading_records')
        .insert(gradingRecords)
        .select();

      if (error) throw error;

      // Update session progress
      await this.updateSessionProgress(sessionId, grades.length);

      return data || [];
    } catch (error) {
      console.error('Error grading responses:', error);
      throw new Error('Failed to grade responses');
    }
  }

  /**
   * Auto-grade objective questions
   */
  async autoGradeObjectiveQuestions(sessionId: string, responses: any[]): Promise<GradingRecord[]> {
    try {
      const grades: GradeResponse[] = [];

      for (const response of responses) {
        let pointsAwarded = 0;
        let isCorrect = false;

        // Simple auto-grading logic for objective questions
        if (response.question_type === 'multiple_choice') {
          isCorrect = response.is_correct || false;
          pointsAwarded = isCorrect ? (response.max_points || 1) : 0;
        } else if (response.question_type === 'true_false') {
          isCorrect = response.is_correct || false;
          pointsAwarded = isCorrect ? (response.max_points || 1) : 0;
        } else if (response.question_type === 'fill_blank') {
          isCorrect = response.is_correct || false;
          pointsAwarded = isCorrect ? (response.max_points || 1) : 0;
        }

        grades.push({
          responseId: response.id,
          responseType: response.attempt_id ? 'assessment_response' : 'quiz_response',
          pointsAwarded,
          maxPoints: response.max_points || 1,
          performanceLevel: isCorrect ? 'Proficient' : 'Needs Improvement',
          feedback: isCorrect ? 'Correct answer!' : 'Incorrect. Please review the material.',
          confidenceScore: 1.0, // High confidence for objective questions
          flags: isCorrect ? [] : ['needs_review']
        });
      }

      return await this.gradeResponses(sessionId, grades);
    } catch (error) {
      console.error('Error auto-grading objective questions:', error);
      throw new Error('Failed to auto-grade questions');
    }
  }

  /**
   * AI-assisted grading for subjective questions
   */
  async aiAssistedGrading(sessionId: string, responses: any[], rubricId?: string): Promise<GradingRecord[]> {
    try {
      // This would integrate with an AI service for grading
      // For now, implementing a placeholder that assigns partial credit
      const grades: GradeResponse[] = [];

      for (const response of responses) {
        if (response.question_type === 'short_answer' || response.question_type === 'essay') {
          const textLength = response.text_response?.length || 0;
          const maxPoints = response.max_points || 10;
          
          // Simple heuristic: award points based on response length and keywords
          let pointsAwarded = Math.min(maxPoints, Math.max(0, textLength / 50));
          
          // Round to nearest 0.5
          pointsAwarded = Math.round(pointsAwarded * 2) / 2;
          
          const performanceLevel = pointsAwarded >= maxPoints * 0.8 ? 'Proficient' : 
                                 pointsAwarded >= maxPoints * 0.6 ? 'Developing' : 'Needs Improvement';

          grades.push({
            responseId: response.id,
            responseType: response.attempt_id ? 'assessment_response' : 'quiz_response',
            pointsAwarded,
            maxPoints,
            performanceLevel,
            feedback: `AI-assisted grading: ${performanceLevel}. Consider reviewing for completeness.`,
            confidenceScore: 0.7, // Moderate confidence for AI grading
            flags: pointsAwarded < maxPoints * 0.6 ? ['needs_review', 'ai_graded'] : ['ai_graded']
          });
        }
      }

      return await this.gradeResponses(sessionId, grades);
    } catch (error) {
      console.error('Error in AI-assisted grading:', error);
      throw new Error('Failed to perform AI-assisted grading');
    }
  }

  /**
   * Update session progress
   */
  private async updateSessionProgress(sessionId: string, gradedCount: number): Promise<void> {
    try {
      const { data: session } = await this.supabase
        .from('grading_sessions')
        .select('graded_responses, total_responses')
        .eq('id', sessionId)
        .single();

      if (session) {
        const newGradedCount = (session.graded_responses || 0) + gradedCount;
        const isComplete = newGradedCount >= (session.total_responses || 0);

        await this.supabase
          .from('grading_sessions')
          .update({
            graded_responses: newGradedCount,
            completed_at: isComplete ? new Date().toISOString() : null
          })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Error updating session progress:', error);
    }
  }

  /**
   * Get grading session with records
   */
  async getGradingSession(sessionId: string): Promise<{
    session: GradingSession;
    records: GradingRecord[];
  } | null> {
    try {
      const { data: session, error: sessionError } = await this.supabase
        .from('grading_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!session) return null;

      const { data: records, error: recordsError } = await this.supabase
        .from('grading_records')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      if (recordsError) throw recordsError;

      return { session, records: records || [] };
    } catch (error) {
      console.error('Error fetching grading session:', error);
      return null;
    }
  }

  /**
   * Calculate final grade for an assessment
   */
  async calculateFinalGrade(sessionId: string): Promise<{
    totalPoints: number;
    maxPoints: number;
    percentage: number;
    letterGrade: string;
    passed: boolean;
  }> {
    try {
      const { data: records, error } = await this.supabase
        .from('grading_records')
        .select('points_awarded, max_points')
        .eq('session_id', sessionId);

      if (error) throw error;

      const totalPoints = records?.reduce((sum, record) => sum + (record.points_awarded || 0), 0) || 0;
      const maxPoints = records?.reduce((sum, record) => sum + (record.max_points || 0), 0) || 0;
      const percentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

      // Letter grade calculation
      let letterGrade = 'F';
      if (percentage >= 97) letterGrade = 'A+';
      else if (percentage >= 93) letterGrade = 'A';
      else if (percentage >= 90) letterGrade = 'A-';
      else if (percentage >= 87) letterGrade = 'B+';
      else if (percentage >= 83) letterGrade = 'B';
      else if (percentage >= 80) letterGrade = 'B-';
      else if (percentage >= 77) letterGrade = 'C+';
      else if (percentage >= 73) letterGrade = 'C';
      else if (percentage >= 70) letterGrade = 'C-';
      else if (percentage >= 67) letterGrade = 'D+';
      else if (percentage >= 63) letterGrade = 'D';
      else if (percentage >= 60) letterGrade = 'D-';

      const passed = percentage >= 70; // 70% passing threshold

      return {
        totalPoints,
        maxPoints,
        percentage: Math.round(percentage * 100) / 100,
        letterGrade,
        passed
      };
    } catch (error) {
      console.error('Error calculating final grade:', error);
      throw new Error('Failed to calculate final grade');
    }
  }

  /**
   * Create default rubrics for common assessment types
   */
  async createDefaultRubrics(baseClassId: string, userId: string): Promise<Rubric[]> {
    const defaultRubrics: CreateRubricRequest[] = [
      {
        name: 'Multiple Choice Assessment',
        description: 'Standard rubric for multiple choice questions',
        baseClassId,
        rubricType: 'checklist',
        gradingScale: 'points',
        criteria: [
          {
            name: 'Accuracy',
            description: 'Correctness of selected answers',
            weight: 1.0,
            maxPoints: 1,
            performanceLevels: [
              { level: 'Correct', points: 1, description: 'Selected the correct answer' },
              { level: 'Incorrect', points: 0, description: 'Selected an incorrect answer' }
            ],
            orderIndex: 0
          }
        ]
      },
      {
        name: 'Essay Assessment',
        description: 'Comprehensive rubric for essay questions',
        baseClassId,
        rubricType: 'analytic',
        gradingScale: 'points',
        criteria: [
          {
            name: 'Content Knowledge',
            description: 'Demonstrates understanding of key concepts',
            weight: 0.4,
            maxPoints: 4,
            performanceLevels: [
              { level: 'Exemplary', points: 4, description: 'Demonstrates comprehensive understanding with sophisticated insights' },
              { level: 'Proficient', points: 3, description: 'Shows solid understanding of key concepts' },
              { level: 'Developing', points: 2, description: 'Shows basic understanding with some gaps' },
              { level: 'Beginning', points: 1, description: 'Shows minimal understanding' }
            ],
            orderIndex: 0
          },
          {
            name: 'Organization',
            description: 'Clear structure and logical flow',
            weight: 0.3,
            maxPoints: 4,
            performanceLevels: [
              { level: 'Exemplary', points: 4, description: 'Exceptionally well-organized with clear transitions' },
              { level: 'Proficient', points: 3, description: 'Well-organized with logical structure' },
              { level: 'Developing', points: 2, description: 'Generally organized with some unclear sections' },
              { level: 'Beginning', points: 1, description: 'Poor organization, difficult to follow' }
            ],
            orderIndex: 1
          },
          {
            name: 'Writing Quality',
            description: 'Grammar, syntax, and clarity',
            weight: 0.3,
            maxPoints: 4,
            performanceLevels: [
              { level: 'Exemplary', points: 4, description: 'Excellent writing with varied sentence structure' },
              { level: 'Proficient', points: 3, description: 'Good writing with minor errors' },
              { level: 'Developing', points: 2, description: 'Adequate writing with some errors' },
              { level: 'Beginning', points: 1, description: 'Poor writing that interferes with meaning' }
            ],
            orderIndex: 2
          }
        ]
      }
    ];

    const createdRubrics: Rubric[] = [];
    
    for (const rubricRequest of defaultRubrics) {
      try {
        const { rubric } = await this.createRubric(rubricRequest, userId);
        createdRubrics.push(rubric);
      } catch (error) {
        console.error(`Error creating default rubric ${rubricRequest.name}:`, error);
      }
    }

    return createdRubrics;
  }
} 