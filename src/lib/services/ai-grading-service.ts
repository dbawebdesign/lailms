import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import pLimit from 'p-limit';

// Types for AI grading functionality
interface GradingRequest {
  attemptId: string;
  questionId: string;
  studentResponse: string;
  questionText: string;
  answerKey: any;
  sampleResponse?: string;
  gradingRubric?: any;
  maxPoints: number;
}

interface GradingResult {
  score: number;
  feedback: string;
  confidence: number;
  reasoning: string;
  suggestions?: string[];
}

interface StudentResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  response_data: any;
  ai_score?: number;
  ai_feedback?: string;
  ai_confidence?: number;
  final_score?: number;
}

const limit = pLimit(2); // Limit concurrent grading requests

export class AIGradingService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Main entry point for grading a student attempt
  async gradeAttempt(attemptId: string, onProgress?: (message: string) => void): Promise<void> {
    const supabase = createSupabaseServerClient();
    
    try {
      onProgress?.('Fetching student responses for grading...');
      
      // Get all responses for this attempt that need AI grading
      const { data: responses, error: responsesError } = await supabase
        .from('student_responses')
        .select(`
          *,
          assessment_questions!inner(
            question_text,
            question_type,
            answer_key,
            sample_response,
            grading_rubric,
            points,
            ai_grading_enabled
          )
        `)
        .eq('attempt_id', attemptId)
        .eq('assessment_questions.ai_grading_enabled', true)
        .in('assessment_questions.question_type', ['short_answer', 'essay'])
        .is('ai_score', null);

      if (responsesError) throw responsesError;
      if (!responses || responses.length === 0) {
        onProgress?.('No responses requiring AI grading found');
        return;
      }

      onProgress?.(`Grading ${responses.length} responses with AI...`);

      // Grade each response
      const gradingPromises = responses.map(response => 
        this.gradeIndividualResponse(response, onProgress)
      );

      await Promise.all(gradingPromises);

      // Update attempt status
      await this.updateAttemptGradingStatus(attemptId);
      
      onProgress?.('AI grading completed successfully');

    } catch (error) {
      console.error('Error in AI grading:', error);
      throw new Error('Failed to complete AI grading');
    }
  }

  // Grade an individual response
  private async gradeIndividualResponse(
    responseData: any,
    onProgress?: (message: string) => void
  ): Promise<void> {
    const supabase = createSupabaseServerClient();
    
    try {
      const question = responseData.assessment_questions;
      const studentAnswer = this.extractStudentAnswer(responseData.response_data, question.question_type);
      
      if (!studentAnswer || studentAnswer.trim().length === 0) {
        // Handle empty responses
        await this.saveGradingResult(responseData.id, {
          score: 0,
          feedback: 'No response provided',
          confidence: 1.0,
          reasoning: 'Empty response automatically scored as 0'
        });
        return;
      }

      const gradingRequest: GradingRequest = {
        attemptId: responseData.attempt_id,
        questionId: responseData.question_id,
        studentResponse: studentAnswer,
        questionText: question.question_text,
        answerKey: question.answer_key,
        sampleResponse: question.sample_response,
        gradingRubric: question.grading_rubric,
        maxPoints: question.points || 1
      };

      const gradingResult = await this.performAIGrading(gradingRequest);
      await this.saveGradingResult(responseData.id, gradingResult);
      
      onProgress?.(`Graded response for question: ${question.question_text.substring(0, 50)}...`);

    } catch (error) {
      console.error('Error grading individual response:', error);
      // Save error state
      await this.saveGradingError(responseData.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Perform the actual AI grading using GPT-4.1-mini
  private async performAIGrading(request: GradingRequest): Promise<GradingResult> {
    try {
      const prompt = this.buildGradingPrompt(request);
      
      const response = await limit(() =>
        this.openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational assessor. Grade student responses fairly and provide constructive feedback. Return structured JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent grading
          max_tokens: 1000,
        })
      );

      const resultText = response.choices[0].message?.content;
      if (!resultText) {
        throw new Error('Empty response from AI grading');
      }

      return this.parseGradingResult(resultText, request.maxPoints);

    } catch (error) {
      console.error('Error in AI grading API call:', error);
      return {
        score: 0,
        feedback: 'Grading system error - manual review required',
        confidence: 0,
        reasoning: 'AI grading failed'
      };
    }
  }

  // Build the grading prompt based on question type
  private buildGradingPrompt(request: GradingRequest): string {
    const { questionText, studentResponse, answerKey, sampleResponse, gradingRubric, maxPoints } = request;
    
    const basePrompt = `
Grade this student response to an assessment question.

QUESTION: ${questionText}

STUDENT RESPONSE:
"${studentResponse}"

MAX POINTS: ${maxPoints}
`;

    if (sampleResponse) {
      return basePrompt + `
SAMPLE CORRECT RESPONSE:
"${sampleResponse}"

ANSWER KEY: ${JSON.stringify(answerKey)}

${gradingRubric ? `GRADING RUBRIC: ${JSON.stringify(gradingRubric)}` : ''}

GRADING INSTRUCTIONS:
1. Compare the student response to the sample response and answer key
2. Award points based on accuracy, completeness, and understanding demonstrated
3. Provide specific, constructive feedback
4. Rate your confidence in the grading (0.0-1.0)

OUTPUT FORMAT (JSON):
{
  "score": 0.0,
  "feedback": "Specific feedback explaining the grade",
  "confidence": 0.95,
  "reasoning": "Brief explanation of scoring rationale",
  "suggestions": ["improvement suggestion 1", "improvement suggestion 2"]
}`;
    }

    // Fallback for questions without sample responses
    return basePrompt + `
ANSWER KEY: ${JSON.stringify(answerKey)}

GRADING INSTRUCTIONS:
1. Evaluate based on the answer key criteria
2. Award partial credit for partially correct responses
3. Provide constructive feedback
4. Rate your confidence in the grading (0.0-1.0)

OUTPUT FORMAT (JSON):
{
  "score": 0.0,
  "feedback": "Specific feedback explaining the grade",
  "confidence": 0.95,
  "reasoning": "Brief explanation of scoring rationale",
  "suggestions": ["improvement suggestion 1", "improvement suggestion 2"]
}`;
  }

  // Parse the AI grading result
  private parseGradingResult(resultText: string, maxPoints: number): GradingResult {
    try {
      const cleanedResponse = resultText.replace(/^```json\s*|```$/gm, '').trim();
      const parsed = JSON.parse(cleanedResponse);

      // Ensure score is within valid range
      const score = Math.max(0, Math.min(maxPoints, parsed.score || 0));
      const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

      return {
        score,
        feedback: parsed.feedback || 'No feedback provided',
        confidence,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      };

    } catch (error) {
      console.error('Error parsing grading result:', error);
      return {
        score: 0,
        feedback: 'Unable to parse grading result - manual review required',
        confidence: 0,
        reasoning: 'JSON parsing failed'
      };
    }
  }

  // Extract student answer from response data based on question type
  private extractStudentAnswer(responseData: any, questionType: string): string {
    if (!responseData) return '';

    switch (questionType) {
      case 'short_answer':
        return responseData.answer || responseData.text || '';
      case 'essay':
        return responseData.essay || responseData.text || responseData.content || '';
      default:
        return responseData.text || responseData.answer || '';
    }
  }

  // Save grading result to database
  private async saveGradingResult(responseId: string, result: GradingResult): Promise<void> {
    const supabase = createSupabaseServerClient();

    try {
      const { error } = await supabase
        .from('student_responses')
        .update({
          ai_score: result.score,
          ai_feedback: result.feedback,
          ai_confidence: result.confidence,
          ai_graded_at: new Date().toISOString(),
          final_score: result.score // Use AI score as final score initially
        })
        .eq('id', responseId);

      if (error) throw error;

    } catch (error) {
      console.error('Error saving grading result:', error);
      throw new Error('Failed to save grading result');
    }
  }

  // Save grading error state
  private async saveGradingError(responseId: string, errorMessage: string): Promise<void> {
    const supabase = createSupabaseServerClient();

    try {
      const { error } = await supabase
        .from('student_responses')
        .update({
          ai_score: null,
          ai_feedback: `Grading error: ${errorMessage}`,
          ai_confidence: 0,
          ai_graded_at: new Date().toISOString()
        })
        .eq('id', responseId);

      if (error) throw error;

    } catch (error) {
      console.error('Error saving grading error:', error);
    }
  }

  // Update attempt grading status
  private async updateAttemptGradingStatus(attemptId: string): Promise<void> {
    const supabase = createSupabaseServerClient();

    try {
      // Calculate total scores
      const { data: responses, error: responsesError } = await supabase
        .from('student_responses')
        .select('final_score, assessment_questions!inner(points)')
        .eq('attempt_id', attemptId);

      if (responsesError) throw responsesError;

      const totalPossible = responses?.reduce((sum, r) => sum + (r.assessment_questions.points || 0), 0) || 0;
      const totalEarned = responses?.reduce((sum, r) => sum + (r.final_score || 0), 0) || 0;
      const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

      // Update attempt with calculated scores
      const { error: updateError } = await supabase
        .from('student_attempts')
        .update({
          total_points: totalPossible,
          earned_points: totalEarned,
          percentage_score: percentage,
          ai_grading_status: 'completed',
          ai_graded_at: new Date().toISOString(),
          status: 'graded'
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error updating attempt grading status:', error);
      throw new Error('Failed to update attempt grading status');
    }
  }

  // Batch grade multiple attempts
  async batchGradeAttempts(attemptIds: string[], onProgress?: (message: string) => void): Promise<void> {
    onProgress?.(`Starting batch grading for ${attemptIds.length} attempts...`);

    for (let i = 0; i < attemptIds.length; i++) {
      const attemptId = attemptIds[i];
      onProgress?.(`Grading attempt ${i + 1}/${attemptIds.length}: ${attemptId}`);
      
      try {
        await this.gradeAttempt(attemptId, onProgress);
      } catch (error) {
        console.error(`Error grading attempt ${attemptId}:`, error);
        onProgress?.(`Error grading attempt ${attemptId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    onProgress?.('Batch grading completed');
  }

  // Manual override for instructor grading
  async applyManualGrade(
    responseId: string,
    manualScore: number,
    manualFeedback: string,
    gradedBy: string,
    overrideReason?: string
  ): Promise<void> {
    const supabase = createSupabaseServerClient();

    try {
      const { error } = await supabase
        .from('student_responses')
        .update({
          manual_score: manualScore,
          manual_feedback: manualFeedback,
          manually_graded_by: gradedBy,
          manually_graded_at: new Date().toISOString(),
          override_reason: overrideReason,
          final_score: manualScore // Manual score overrides AI score
        })
        .eq('id', responseId);

      if (error) throw error;

      // Recalculate attempt totals
      const { data: response } = await supabase
        .from('student_responses')
        .select('attempt_id')
        .eq('id', responseId)
        .single();

      if (response) {
        await this.updateAttemptGradingStatus(response.attempt_id);
      }

    } catch (error) {
      console.error('Error applying manual grade:', error);
      throw new Error('Failed to apply manual grade');
    }
  }
} 