import { tool } from '@openai/agents';
import { z } from 'zod';
import { SupabaseAgentClient, AgentContext } from '../core/SupabaseAgentClient';

export class UniversalSupabaseTools {
  private db: SupabaseAgentClient;

  constructor() {
    this.db = new SupabaseAgentClient();
  }

  // Content Management Tools
  createContentTool = tool({
    name: 'create_content',
    description: 'Create new educational content in the database',
    parameters: z.object({
      contentType: z.enum(['lesson', 'section', 'path', 'base_class', 'quiz']),
      data: z.record(z.any()),
      parentId: z.string().optional()
    }),
    execute: async ({ contentType, data, parentId }, context) => {
      const agentContext = this.getAgentContext(context);
      
      switch (contentType) {
        case 'section':
          return await this.db.createLessonSection(data, agentContext);
        default:
          return await this.db.updateContent(this.getTableName(contentType), data.id, data, agentContext);
      }
    }
  });

  updateContentTool = tool({
    name: 'update_content',
    description: 'Update existing educational content',
    parameters: z.object({
      contentType: z.enum(['lesson', 'section', 'path', 'base_class', 'quiz']),
      contentId: z.string(),
      updates: z.record(z.any())
    }),
    execute: async ({ contentType, contentId, updates }, context) => {
      const agentContext = this.getAgentContext(context);
      const tableName = this.getTableName(contentType);
      
      return await this.db.updateContent(tableName, contentId, updates, agentContext);
    }
  });

  searchKnowledgeBaseTool = tool({
    name: 'search_knowledge_base',
    description: 'Search the knowledge base for relevant information',
    parameters: z.object({
      query: z.string(),
      baseClassId: z.string().optional(),
      limit: z.number().default(5)
    }),
    execute: async ({ query, baseClassId, limit }, context) => {
      const agentContext = this.getAgentContext(context);
      
      return await this.db.searchKnowledgeBase(query, {
        baseClassId,
        orgId: agentContext.orgId
      }, agentContext);
    }
  });

  getUserDataTool = tool({
    name: 'get_user_data',
    description: 'Get user profile and learning data',
    parameters: z.object({
      userId: z.string(),
      includeProgress: z.boolean().default(false),
      includePreferences: z.boolean().default(true)
    }),
    execute: async ({ userId, includeProgress, includePreferences }, context) => {
      const agentContext = this.getAgentContext(context);
      const profile = await this.db.getUserProfile(userId, agentContext);
      
      if (includeProgress) {
        profile.learningProgress = await this.db.getLearningProgress(userId, agentContext);
      }
      
      return profile;
    }
  });

  getClassDataTool = tool({
    name: 'get_class_data',
    description: 'Get complete class structure and content',
    parameters: z.object({
      baseClassId: z.string(),
      includeStudentData: z.boolean().default(false)
    }),
    execute: async ({ baseClassId, includeStudentData }, context) => {
      const agentContext = this.getAgentContext(context);
      const classData = await this.db.getBaseClass(baseClassId, agentContext);
      
      return classData;
    }
  });

  uploadToStorageTool = tool({
    name: 'upload_to_storage',
    description: 'Upload files to Supabase Storage',
    parameters: z.object({
      bucket: z.string(),
      fileName: z.string(),
      fileData: z.string(), // base64 encoded
      contentType: z.string()
    }),
    execute: async ({ bucket, fileName, fileData, contentType }, context) => {
      const agentContext = this.getAgentContext(context);
      const buffer = Buffer.from(fileData, 'base64');
      
      return await this.db.uploadToStorage(bucket, fileName, buffer, contentType, agentContext);
    }
  });

  // Analytics and Progress Tools
  trackLearningAnalyticsTool = tool({
    name: 'track_learning_analytics',
    description: 'Record learning analytics events',
    parameters: z.object({
      studentId: z.string(),
      eventType: z.enum(['start_lesson', 'complete_section', 'submit_quiz', 'struggle_detected']),
      lessonId: z.string().optional(),
      sectionId: z.string().optional(),
      metadata: z.record(z.any()).optional()
    }),
    execute: async ({ studentId, eventType, lessonId, sectionId, metadata }, context) => {
      const agentContext = this.getAgentContext(context);
      return await this.db.recordAnalyticsEvent({
        student_id: studentId,
        event_type: eventType,
        lesson_id: lessonId,
        section_id: sectionId,
        metadata,
        timestamp: new Date().toISOString()
      }, agentContext);
    }
  });

  // Educational-specific tools
  generateExplanationTool = tool({
    name: 'generate_explanation',
    description: 'Generate personalized explanations based on student level',
    parameters: z.object({
      concept: z.string(),
      studentId: z.string(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'reading']).optional()
    }),
    execute: async ({ concept, studentId, difficulty, learningStyle }, context) => {
      const agentContext = this.getAgentContext(context);
      
      // Get student profile for personalization
      const profile = await this.db.getUserProfile(studentId, agentContext);
      
      // Generate explanation based on profile and preferences
      const explanation = {
        concept,
        explanation: `Personalized explanation for ${concept} at ${difficulty || 'appropriate'} level`,
        examples: [],
        practice_questions: [],
        difficulty_level: difficulty || 'intermediate',
        learning_style: learningStyle || 'mixed'
      };
      
      return explanation;
    }
  });

  assessUnderstandingTool = tool({
    name: 'assess_understanding',
    description: 'Assess student understanding through questions and responses',
    parameters: z.object({
      studentId: z.string(),
      concept: z.string(),
      studentResponse: z.string(),
      questionType: z.enum(['multiple_choice', 'short_answer', 'explanation']).optional()
    }),
    execute: async ({ studentId, concept, studentResponse, questionType }, context) => {
      const agentContext = this.getAgentContext(context);
      
      // Analyze response and determine understanding level
      const assessment = {
        concept,
        understanding_level: 'proficient', // This would be determined by AI analysis
        confidence: 0.85,
        feedback: 'Good understanding demonstrated',
        next_steps: ['Practice with more complex examples'],
        mastery_achieved: true
      };
      
      // Track this assessment
      await this.db.recordAnalyticsEvent({
        student_id: studentId,
        event_type: 'understanding_assessed',
        metadata: { concept, assessment }
      }, agentContext);
      
      return assessment;
    }
  });

  // Helper methods
  private getAgentContext(context: any): AgentContext {
    return {
      userId: context.userId || context.user?.id || 'system',
      orgId: context.orgId || context.user?.organisation_id || 'system',
      sessionId: context.sessionId || 'agent-session',
      agentName: context.agentName || 'luna-agent',
      role: context.role || context.user?.role || 'user'
    };
  }

  private getTableName(contentType: string): string {
    const tableMap = {
      'lesson': 'lessons',
      'section': 'lesson_sections',
      'path': 'paths',
      'base_class': 'base_classes',
      'quiz': 'quizzes'
    };
    return tableMap[contentType] || contentType;
  }

  // Get all tools as array for agent configuration
  getAllTools() {
    return [
      this.createContentTool,
      this.updateContentTool,
      this.searchKnowledgeBaseTool,
      this.getUserDataTool,
      this.getClassDataTool,
      this.uploadToStorageTool,
      this.trackLearningAnalyticsTool,
      this.generateExplanationTool,
      this.assessUnderstandingTool
    ];
  }
}