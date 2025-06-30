import { createClient } from '@/lib/supabase/client';
import { Database } from '../../../packages/types/db';

type StudentResponse = Database['public']['Tables']['student_responses']['Row'];
type StudentAttempt = Database['public']['Tables']['student_attempts']['Row'];

export interface StudentProfile {
  userId: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  performanceHistory: PerformanceData[];
  strengths: string[];
  weaknesses: string[];
  preferredFeedbackType: 'detailed' | 'concise' | 'encouraging' | 'analytical';
}

export interface PerformanceData {
  assessmentId: string;
  score: number;
  maxScore: number;
  completionTime: number;
  questionTypes: string[];
  conceptsAssessed: string[];
  timestamp: Date;
}

export interface FeedbackRequest {
  responseId: string;
  responseType: 'assessment_response' | 'quiz_response';
  questionType: string;
  studentAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  conceptsAssessed: string[];
  learningObjectives: string[];
  studentProfile?: StudentProfile;
  contextualData?: {
    lessonId?: string;
    pathId?: string;
    baseClassId?: string;
    attemptNumber?: number;
    timeSpent?: number;
  };
}

export interface GeneratedFeedback {
  id: string;
  responseId: string;
  feedbackType: 'immediate' | 'detailed' | 'summary' | 'remedial';
  content: {
    primary: string;
    explanation?: string;
    encouragement?: string;
    suggestions?: string[];
    resources?: ResourceRecommendation[];
  };
  tone: 'encouraging' | 'neutral' | 'constructive' | 'celebratory';
  personalization: {
    learningStyleAdapted: boolean;
    performanceHistoryConsidered: boolean;
    strengthsHighlighted: boolean;
    weaknessesAddressed: boolean;
  };
  metadata: {
    generatedAt: Date;
    confidence: number;
    aiModel: string;
    processingTime: number;
  };
}

export interface ResourceRecommendation {
  type: 'video' | 'article' | 'practice' | 'tutorial' | 'interactive';
  title: string;
  description: string;
  url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  relevanceScore: number;
}

export interface FeedbackTemplate {
  id: string;
  name: string;
  questionTypes: string[];
  scenarios: FeedbackScenario[];
  personalizationRules: PersonalizationRule[];
}

export interface FeedbackScenario {
  condition: string; // e.g., "correct_answer", "partial_credit", "incorrect_common_mistake"
  templates: {
    encouraging: string;
    neutral: string;
    constructive: string;
    celebratory: string;
  };
  suggestions: string[];
  resourceTypes: string[];
}

export interface PersonalizationRule {
  condition: string;
  learningStyles: string[];
  performanceThresholds: {
    struggling: number;
    average: number;
    excelling: number;
  };
  adaptations: {
    tone: string;
    contentLength: 'brief' | 'moderate' | 'detailed';
    includeVisuals: boolean;
    includeAudio: boolean;
    emphasizeStrengths: boolean;
  };
}

export class FeedbackService {
  private supabase = createClient();
  private feedbackTemplates: Map<string, FeedbackTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate personalized feedback for a student response
   */
  async generateFeedback(request: FeedbackRequest): Promise<GeneratedFeedback> {
    const startTime = Date.now();

    try {
      // Get or create student profile
      const studentProfile = request.studentProfile || await this.getStudentProfile(request.responseId);

      // Determine feedback scenario
      const scenario = this.determineFeedbackScenario(request);

      // Generate base feedback content
      const baseContent = await this.generateBaseFeedback(request, scenario);

      // Personalize feedback based on student profile
      const personalizedContent = this.personalizeFeedback(baseContent, studentProfile, request);

      // Generate resource recommendations
      const resources = await this.generateResourceRecommendations(request, studentProfile);

      // Determine appropriate tone
      const tone = this.determineFeedbackTone(request, studentProfile);

      const feedback: GeneratedFeedback = {
        id: crypto.randomUUID(),
        responseId: request.responseId,
        feedbackType: this.determineFeedbackType(request),
        content: {
          primary: personalizedContent.primary,
          explanation: personalizedContent.explanation,
          encouragement: personalizedContent.encouragement,
          suggestions: personalizedContent.suggestions,
          resources
        },
        tone,
        personalization: {
          learningStyleAdapted: true,
          performanceHistoryConsidered: studentProfile.performanceHistory.length > 0,
          strengthsHighlighted: studentProfile.strengths.length > 0,
          weaknessesAddressed: studentProfile.weaknesses.length > 0
        },
        metadata: {
          generatedAt: new Date(),
          confidence: this.calculateConfidenceScore(request, studentProfile),
          aiModel: 'claude-3-sonnet',
          processingTime: Date.now() - startTime
        }
      };

      // Store feedback for future analysis
      await this.storeFeedback(feedback);

      return feedback;
    } catch (error) {
      console.error('Error generating feedback:', error);
      return this.generateFallbackFeedback(request);
    }
  }

  /**
   * Generate feedback for multiple responses (batch processing)
   */
  async generateBatchFeedback(requests: FeedbackRequest[]): Promise<GeneratedFeedback[]> {
    const feedbacks: GeneratedFeedback[] = [];

    // Process in chunks to avoid overwhelming the system
    const chunkSize = 10;
    for (let i = 0; i < requests.length; i += chunkSize) {
      const chunk = requests.slice(i, i + chunkSize);
      const chunkFeedbacks = await Promise.all(
        chunk.map(request => this.generateFeedback(request))
      );
      feedbacks.push(...chunkFeedbacks);
    }

    return feedbacks;
  }

  /**
   * Get student profile with learning patterns and preferences
   */
  private async getStudentProfile(responseId: string): Promise<StudentProfile> {
    try {
      // Get user ID from student response
      const { data: response } = await this.supabase
        .from('student_responses')
        .select('attempt_id')
        .eq('id', responseId)
        .single();

      if (!response) {
        return this.createDefaultProfile('unknown');
      }

      const { data: attempt } = await this.supabase
        .from('student_attempts')
        .select('student_id')
        .eq('id', response.attempt_id)
        .single();

      if (!attempt) {
        return this.createDefaultProfile('unknown');
      }

      // Get performance history from student attempts
      const { data: performanceData } = await this.supabase
        .from('student_attempts')
        .select(`
          id,
          score,
          created_at,
          time_spent_seconds,
          assessment_id,
          assessments (
            lesson_id,
            lessons (
              path_id,
              base_class_id
            )
          )
        `)
        .eq('student_id', attempt.student_id)
        .order('created_at', { ascending: false })
        .limit(20);

      const performanceHistory: PerformanceData[] = (performanceData || []).map(data => ({
        assessmentId: data.id,
        score: data.score || 0,
        maxScore: 100, // Assuming percentage-based scoring
        completionTime: data.time_spent_seconds || 0,
        questionTypes: [], // Would be populated from actual question data
        conceptsAssessed: [], // Would be populated from lesson/path data
        timestamp: new Date(data.created_at)
      }));

      // Analyze patterns to determine learning style and preferences
      const learningStyle = this.analyzeLearningStyle(performanceHistory);
      const strengths = this.identifyStrengths(performanceHistory);
      const weaknesses = this.identifyWeaknesses(performanceHistory);
      const preferredFeedbackType = this.determinePreferredFeedbackType(performanceHistory);

      return {
        userId: attempt.student_id,
        learningStyle,
        performanceHistory,
        strengths,
        weaknesses,
        preferredFeedbackType
      };
    } catch (error) {
      console.error('Error getting student profile:', error);
      return this.createDefaultProfile('unknown');
    }
  }

  /**
   * Determine the appropriate feedback scenario based on response
   */
  private determineFeedbackScenario(request: FeedbackRequest): string {
    if (request.isCorrect) {
      return request.pointsAwarded === request.maxPoints ? 'perfect_answer' : 'partial_credit';
    }

    // Analyze common mistakes for incorrect answers
    if (request.questionType === 'multiple_choice') {
      return 'incorrect_multiple_choice';
    } else if (request.questionType === 'short_answer' || request.questionType === 'essay') {
      return 'incorrect_open_ended';
    } else if (request.questionType === 'fill_blank') {
      return 'incorrect_fill_blank';
    }

    return 'incorrect_general';
  }

  /**
   * Generate base feedback content using AI
   */
  private async generateBaseFeedback(request: FeedbackRequest, scenario: string): Promise<any> {
    // This would integrate with Claude or another LLM for dynamic feedback generation
    // For now, using template-based approach with some intelligence

    const templates = this.getTemplateForScenario(scenario, request.questionType);
    
    if (request.isCorrect) {
      return {
        primary: templates.correct.primary
          .replace('{concept}', request.conceptsAssessed.join(', '))
          .replace('{points}', request.pointsAwarded.toString()),
        explanation: templates.correct.explanation,
        encouragement: templates.correct.encouragement,
        suggestions: templates.correct.suggestions
      };
    } else {
      return {
        primary: templates.incorrect.primary
          .replace('{concept}', request.conceptsAssessed.join(', '))
          .replace('{correct_answer}', this.formatAnswer(request.correctAnswer)),
        explanation: templates.incorrect.explanation,
        encouragement: templates.incorrect.encouragement,
        suggestions: templates.incorrect.suggestions
      };
    }
  }

  /**
   * Personalize feedback based on student profile
   */
  private personalizeFeedback(baseContent: any, profile: StudentProfile, request: FeedbackRequest): any {
    let personalizedContent = { ...baseContent };

    // Adapt for learning style
    if (profile.learningStyle === 'visual') {
      personalizedContent.suggestions = [
        ...personalizedContent.suggestions,
        'Try creating a visual diagram or chart to understand this concept better.',
        'Look for visual examples or infographics related to this topic.'
      ];
    } else if (profile.learningStyle === 'auditory') {
      personalizedContent.suggestions = [
        ...personalizedContent.suggestions,
        'Consider discussing this concept with a study partner or explaining it out loud.',
        'Look for audio explanations or podcasts about this topic.'
      ];
    } else if (profile.learningStyle === 'kinesthetic') {
      personalizedContent.suggestions = [
        ...personalizedContent.suggestions,
        'Try hands-on practice or real-world applications of this concept.',
        'Look for interactive simulations or practical exercises.'
      ];
    }

    // Adapt tone based on performance history
    const recentPerformance = profile.performanceHistory.slice(0, 5);
    const averageScore = recentPerformance.reduce((sum, p) => sum + (p.score / p.maxScore), 0) / recentPerformance.length;

    if (averageScore < 0.6) {
      // Struggling student - more encouragement
      personalizedContent.encouragement = 'Remember, learning is a process and every mistake is an opportunity to grow. You\'re making progress!';
    } else if (averageScore > 0.9) {
      // High performer - challenge them
      personalizedContent.encouragement = 'Excellent work! You\'re demonstrating strong mastery of these concepts.';
      personalizedContent.suggestions.push('Consider exploring advanced applications of this concept.');
    }

    // Highlight strengths
    if (profile.strengths.length > 0 && request.isCorrect) {
      personalizedContent.encouragement += ` This aligns well with your strength in ${profile.strengths[0]}.`;
    }

    // Address weaknesses constructively
    if (profile.weaknesses.length > 0 && !request.isCorrect) {
      const relevantWeakness = profile.weaknesses.find(w => 
        request.conceptsAssessed.some(concept => concept.toLowerCase().includes(w.toLowerCase()))
      );
      if (relevantWeakness) {
        personalizedContent.suggestions.unshift(
          `Since ${relevantWeakness} has been challenging for you, let's focus on building that foundation.`
        );
      }
    }

    return personalizedContent;
  }

  /**
   * Generate resource recommendations based on response and profile
   */
  private async generateResourceRecommendations(
    request: FeedbackRequest, 
    profile: StudentProfile
  ): Promise<ResourceRecommendation[]> {
    const resources: ResourceRecommendation[] = [];

    // Base recommendations on question type and correctness
    if (!request.isCorrect) {
      // Remedial resources
      resources.push({
        type: 'tutorial',
        title: `Understanding ${request.conceptsAssessed[0] || 'this concept'}`,
        description: 'Step-by-step explanation of the fundamental concepts',
        difficulty: 'beginner',
        estimatedTime: 15,
        relevanceScore: 0.9
      });

      resources.push({
        type: 'practice',
        title: 'Practice Problems',
        description: 'Additional practice questions on this topic',
        difficulty: 'intermediate',
        estimatedTime: 20,
        relevanceScore: 0.8
      });
    } else if (request.pointsAwarded === request.maxPoints) {
      // Enrichment resources for correct answers
      resources.push({
        type: 'article',
        title: `Advanced Applications of ${request.conceptsAssessed[0] || 'this concept'}`,
        description: 'Explore real-world applications and advanced topics',
        difficulty: 'advanced',
        estimatedTime: 25,
        relevanceScore: 0.7
      });
    }

    // Adapt to learning style
    if (profile.learningStyle === 'visual') {
      resources.push({
        type: 'video',
        title: 'Visual Explanation',
        description: 'Video tutorial with diagrams and visual aids',
        difficulty: 'intermediate',
        estimatedTime: 10,
        relevanceScore: 0.8
      });
    } else if (profile.learningStyle === 'kinesthetic') {
      resources.push({
        type: 'interactive',
        title: 'Interactive Simulation',
        description: 'Hands-on simulation to explore the concept',
        difficulty: 'intermediate',
        estimatedTime: 15,
        relevanceScore: 0.8
      });
    }

    return resources.slice(0, 3); // Limit to top 3 recommendations
  }

  /**
   * Determine appropriate feedback tone
   */
  private determineFeedbackTone(request: FeedbackRequest, profile: StudentProfile): 'encouraging' | 'neutral' | 'constructive' | 'celebratory' {
    if (request.isCorrect && request.pointsAwarded === request.maxPoints) {
      return 'celebratory';
    }

    if (request.isCorrect) {
      return 'encouraging';
    }

    // For incorrect answers, consider student's recent performance
    const recentPerformance = profile.performanceHistory.slice(0, 3);
    const recentAverage = recentPerformance.reduce((sum, p) => sum + (p.score / p.maxScore), 0) / recentPerformance.length;

    if (recentAverage < 0.5) {
      return 'encouraging'; // More support for struggling students
    }

    return 'constructive';
  }

  /**
   * Helper methods for analysis and template management
   */
  private analyzeLearningStyle(history: PerformanceData[]): 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing' {
    // Simple heuristic - in a real implementation, this would be more sophisticated
    return 'visual'; // Default for now
  }

  private identifyStrengths(history: PerformanceData[]): string[] {
    // Analyze performance patterns to identify strengths
    return ['problem solving', 'analytical thinking']; // Placeholder
  }

  private identifyWeaknesses(history: PerformanceData[]): string[] {
    // Analyze performance patterns to identify areas for improvement
    return ['time management']; // Placeholder
  }

  private determinePreferredFeedbackType(history: PerformanceData[]): 'detailed' | 'concise' | 'encouraging' | 'analytical' {
    return 'detailed'; // Default for now
  }

  private createDefaultProfile(userId: string): StudentProfile {
    return {
      userId,
      learningStyle: 'visual',
      performanceHistory: [],
      strengths: [],
      weaknesses: [],
      preferredFeedbackType: 'detailed'
    };
  }

  private determineFeedbackType(request: FeedbackRequest): 'immediate' | 'detailed' | 'summary' | 'remedial' {
    if (!request.isCorrect) {
      return 'remedial';
    }
    return 'immediate';
  }

  private calculateConfidenceScore(request: FeedbackRequest, profile: StudentProfile): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if we have more data about the student
    if (profile.performanceHistory.length > 5) {
      confidence += 0.1;
    }

    // Increase confidence for objective questions
    if (['multiple_choice', 'true_false', 'fill_blank'].includes(request.questionType)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private async storeFeedback(feedback: GeneratedFeedback): Promise<void> {
    try {
      // Store feedback in database for analytics and improvement
      await this.supabase
        .from('feedback_records')
        .insert({
          id: feedback.id,
          response_id: feedback.responseId,
          feedback_type: feedback.feedbackType,
          content: feedback.content,
          tone: feedback.tone,
          personalization: feedback.personalization,
          metadata: feedback.metadata
        });
    } catch (error) {
      console.error('Error storing feedback:', error);
    }
  }

  private generateFallbackFeedback(request: FeedbackRequest): GeneratedFeedback {
    return {
      id: crypto.randomUUID(),
      responseId: request.responseId,
      feedbackType: 'immediate',
      content: {
        primary: request.isCorrect ? 
          'Correct! Well done.' : 
          'Not quite right. Please review the material and try again.',
        suggestions: ['Review the lesson material', 'Practice similar problems']
      },
      tone: 'neutral',
      personalization: {
        learningStyleAdapted: false,
        performanceHistoryConsidered: false,
        strengthsHighlighted: false,
        weaknessesAddressed: false
      },
      metadata: {
        generatedAt: new Date(),
        confidence: 0.5,
        aiModel: 'fallback',
        processingTime: 0
      }
    };
  }

  private formatAnswer(answer: any): string {
    if (typeof answer === 'string') return answer;
    if (Array.isArray(answer)) return answer.join(', ');
    return JSON.stringify(answer);
  }

  private getTemplateForScenario(scenario: string, questionType: string): any {
    // Template-based feedback - in production, this would be more sophisticated
    return {
      correct: {
        primary: 'Excellent! You correctly identified {concept} and earned {points} points.',
        explanation: 'Your understanding of this concept is solid.',
        encouragement: 'Keep up the great work!',
        suggestions: ['Continue practicing to maintain your skills']
      },
      incorrect: {
        primary: 'Not quite right. The correct answer is {correct_answer}.',
        explanation: 'Let\'s review why this is the correct approach.',
        encouragement: 'Don\'t worry - this is a common area where students need practice.',
        suggestions: ['Review the lesson material', 'Try similar practice problems']
      }
    };
  }

  private initializeTemplates(): void {
    // Initialize feedback templates - this would be loaded from database in production
    // For now, keeping it simple
  }
}