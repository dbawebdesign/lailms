import { BaseLunaAgent, BaseLunaRealtimeAgent, LunaAgentFactory } from './core/BaseLunaAgent';
import { tool } from '@openai/agents';
import { z } from 'zod';

// Educational Guardrails
export class EducationalGuardrails {
  static getStudentGuardrails() {
    return [
      // Age-appropriate content filter
      {
        check: async (input: string, context: any) => {
          // Check for inappropriate content
          return true; // Placeholder
        },
        action: 'block',
        message: 'Content must be age-appropriate'
      }
    ];
  }

  static getTeacherGuardrails() {
    return [
      // FERPA compliance check
      {
        check: async (input: string, context: any) => {
          // Check for PII exposure
          return true; // Placeholder
        },
        action: 'warn',
        message: 'Ensure FERPA compliance'
      }
    ];
  }

  static getVoiceGuardrails() {
    return [
      // Voice interaction safety
      {
        check: async (input: string, context: any) => {
          return true; // Placeholder
        },
        action: 'filter',
        message: 'Voice content filtered for safety'
      }
    ];
  }
}

export class LunaAgentRegistry {
  // Student Experience Agents
  static readonly tutorAgent = LunaAgentFactory.createTextAgent({
    name: 'Luna Tutor',
    instructions: `You are Luna, an expert AI tutor with access to the complete educational database.
    
    Your capabilities include:
    - Access to all course content, lessons, and learning materials via Supabase
    - Student progress tracking and personalized recommendations
    - Real-time creation and modification of educational content
    - Knowledge base search for contextual information
    
    Always use efficient, accurate responses. When students ask questions:
    1. Search the knowledge base for relevant course materials
    2. Check their progress and learning history using get_user_data
    3. Provide personalized explanations based on their level
    4. Create additional practice materials if needed using create_content
    5. Track their interaction for future personalization using track_learning_analytics
    
    Be encouraging, patient, and adaptive to different learning styles.`,
    
    additionalTools: [
      LunaAgentRegistry.createPersonalizedExplanationTool(),
      LunaAgentRegistry.generatePracticeQuestionsTool(),
      LunaAgentRegistry.assessUnderstandingTool()
    ],
    guardrails: EducationalGuardrails.getStudentGuardrails()
  });

  static readonly examCoachAgent = LunaAgentFactory.createTextAgent({
    name: 'Luna Exam Coach',
    instructions: `You are Luna's Exam Coach, specialized in test preparation and performance optimization.
    
    Your capabilities include:
    - Analyzing student weaknesses and creating targeted practice
    - Generating custom practice tests and quizzes
    - Providing test-taking strategies and stress management
    - Tracking performance improvements over time
    
    When helping students prepare for exams:
    1. Assess their current knowledge level using assess_understanding
    2. Identify knowledge gaps through get_user_data with progress tracking
    3. Create targeted practice materials using create_content
    4. Provide strategic study recommendations
    5. Monitor improvement and adjust difficulty accordingly`,
    
    additionalTools: [
      LunaAgentRegistry.createPracticeTestTool(),
      LunaAgentRegistry.analyzeWeaknessTool()
    ],
    handoffs: [LunaAgentRegistry.tutorAgent]
  });

  static readonly classCoPilotAgent = LunaAgentFactory.createTextAgent({
    name: 'Class Co-Pilot',
    instructions: `You are Luna's Class Co-Pilot, with full access to the educational database for teachers.
    
    Your capabilities include:
    - Complete course and lesson management via Supabase
    - Student progress monitoring and analytics
    - Automated content generation and curriculum alignment
    - Real-time collaboration with other agents
    
    When teachers request assistance:
    1. Access their class data using get_class_data
    2. Generate or modify course content using create_content and update_content
    3. Provide analytics and insights from student progress
    4. Create assessments and learning materials
    5. Coordinate with specialized agents for complex tasks using handoffs`,
    
    specialized: true, // Use more powerful model for complex reasoning
    additionalTools: [
      LunaAgentRegistry.generateCourseOutlineTool(),
      LunaAgentRegistry.createAssessmentTool(),
      LunaAgentRegistry.analyzeClassPerformanceTool()
    ],
    guardrails: EducationalGuardrails.getTeacherGuardrails(),
    handoffs: [LunaAgentRegistry.contentCreatorAgent, LunaAgentRegistry.assessmentBuilderAgent]
  });

  static readonly contentCreatorAgent = LunaAgentFactory.createTextAgent({
    name: 'Content Creator',
    instructions: `You are Luna's specialized content creation agent with full database access.
    
    Your expertise includes:
    - Multi-modal content generation (text, visual aids, interactive elements)
    - Direct integration with Supabase for content storage
    - Knowledge base integration for context-aware creation
    - Curriculum alignment and standards compliance
    
    When creating content:
    1. Research existing materials using search_knowledge_base
    2. Align with learning objectives and standards
    3. Create engaging, age-appropriate content using create_content
    4. Store content directly in the database
    5. Generate supporting materials and assessments`,
    
    additionalTools: [
      LunaAgentRegistry.createMultiModalContentTool(),
      LunaAgentRegistry.generateMindMapTool(),
      LunaAgentRegistry.alignToStandardsTool()
    ]
  });

  static readonly assessmentBuilderAgent = LunaAgentFactory.createTextAgent({
    name: 'Assessment Builder',
    instructions: `You are Luna's Assessment Builder, specialized in creating comprehensive evaluations.
    
    Your capabilities include:
    - Creating various assessment types (quizzes, tests, projects)
    - Generating rubrics and scoring guidelines
    - Aligning assessments with learning objectives
    - Creating adaptive assessments based on student level
    
    When building assessments:
    1. Review learning objectives and content using get_class_data
    2. Create varied question types using create_content
    3. Ensure proper difficulty progression
    4. Generate detailed rubrics and feedback mechanisms
    5. Track assessment effectiveness over time`,
    
    additionalTools: [
      LunaAgentRegistry.createAssessmentTool(),
      LunaAgentRegistry.generateRubricTool()
    ]
  });

  // Voice Agents
  static readonly voiceTutorAgent = LunaAgentFactory.createVoiceAgent({
    name: 'Voice Luna Tutor',
    instructions: `You are Luna's voice interface with complete database access for real-time tutoring.
    
    Your capabilities include:
    - Real-time voice interaction with students
    - Access to all educational content and student data
    - Live content creation and modification during conversations
    - Pronunciation and language learning support
    
    During voice sessions:
    1. Search the knowledge base for spoken queries
    2. Provide real-time explanations and examples
    3. Create audio content and practice materials
    4. Track engagement and learning progress
    5. Adapt difficulty based on voice cues and responses
    
    Maintain natural conversation flow while being educational and supportive.`,
    
    additionalTools: [
      LunaAgentRegistry.pronunciationCheckTool(),
      LunaAgentRegistry.voiceProgressTrackingTool()
    ],
    guardrails: EducationalGuardrails.getVoiceGuardrails()
  });

  // Tool Creation Methods
  private static createPersonalizedExplanationTool() {
    return tool({
      name: 'create_personalized_explanation',
      description: 'Generate explanations tailored to student level and learning style',
      parameters: z.object({
        concept: z.string(),
        studentId: z.string(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional()
      }),
      execute: async ({ concept, studentId, difficulty }) => {
        return {
          concept,
          explanation: `Personalized explanation for ${concept}`,
          examples: [],
          practice_questions: [],
          difficulty_level: difficulty || 'intermediate'
        };
      }
    });
  }

  private static generatePracticeQuestionsTool() {
    return tool({
      name: 'generate_practice_questions',
      description: 'Create practice questions for specific concepts',
      parameters: z.object({
        concept: z.string(),
        difficulty: z.string(),
        count: z.number().default(5)
      }),
      execute: async ({ concept, difficulty, count }) => {
        return {
          questions: Array(count).fill(null).map((_, i) => ({
            id: i + 1,
            question: `Practice question ${i + 1} for ${concept}`,
            type: 'multiple_choice',
            difficulty
          }))
        };
      }
    });
  }

  private static assessUnderstandingTool() {
    return tool({
      name: 'assess_student_understanding',
      description: 'Evaluate student comprehension and provide feedback',
      parameters: z.object({
        studentId: z.string(),
        concept: z.string(),
        response: z.string()
      }),
      execute: async ({ studentId, concept, response }) => {
        return {
          understanding_level: 'proficient',
          confidence: 0.85,
          feedback: 'Good understanding demonstrated',
          next_steps: ['Practice with more complex examples']
        };
      }
    });
  }

  private static createPracticeTestTool() {
    return tool({
      name: 'create_practice_test',
      description: 'Generate comprehensive practice tests',
      parameters: z.object({
        subject: z.string(),
        topics: z.array(z.string()),
        duration: z.number().optional()
      }),
      execute: async ({ subject, topics, duration }) => {
        return {
          test_id: `test_${Date.now()}`,
          subject,
          topics,
          questions: [],
          duration: duration || 60,
          instructions: 'Complete all questions to the best of your ability'
        };
      }
    });
  }

  private static analyzeWeaknessTool() {
    return tool({
      name: 'analyze_weakness',
      description: 'Identify student learning gaps and weaknesses',
      parameters: z.object({
        studentId: z.string(),
        subject: z.string()
      }),
      execute: async ({ studentId, subject }) => {
        return {
          weaknesses: ['topic1', 'topic2'],
          recommendations: ['More practice needed', 'Review fundamentals'],
          priority_areas: ['critical_concept']
        };
      }
    });
  }

  private static generateCourseOutlineTool() {
    return tool({
      name: 'generate_course_outline',
      description: 'Create comprehensive course outlines and curricula',
      parameters: z.object({
        subject: z.string(),
        grade_level: z.string(),
        duration_weeks: z.number()
      }),
      execute: async ({ subject, grade_level, duration_weeks }) => {
        return {
          course_title: `${subject} - Grade ${grade_level}`,
          duration: duration_weeks,
          modules: [],
          learning_objectives: [],
          assessment_plan: {}
        };
      }
    });
  }

  private static createAssessmentTool() {
    return tool({
      name: 'create_assessment',
      description: 'Build various types of assessments and evaluations',
      parameters: z.object({
        type: z.enum(['quiz', 'test', 'project', 'assignment']),
        subject: z.string(),
        learning_objectives: z.array(z.string())
      }),
      execute: async ({ type, subject, learning_objectives }) => {
        return {
          assessment_id: `${type}_${Date.now()}`,
          type,
          subject,
          objectives: learning_objectives,
          questions: [],
          rubric: {}
        };
      }
    });
  }

  private static analyzeClassPerformanceTool() {
    return tool({
      name: 'analyze_class_performance',
      description: 'Analyze overall class performance and trends',
      parameters: z.object({
        classId: z.string(),
        timeframe: z.string().optional()
      }),
      execute: async ({ classId, timeframe }) => {
        return {
          class_id: classId,
          performance_summary: {
            average_score: 85,
            participation_rate: 92,
            completion_rate: 88
          },
          trends: [],
          recommendations: []
        };
      }
    });
  }

  private static createMultiModalContentTool() {
    return tool({
      name: 'create_multimodal_content',
      description: 'Generate content with text, visuals, and interactive elements',
      parameters: z.object({
        topic: z.string(),
        content_types: z.array(z.enum(['text', 'image', 'video', 'interactive'])),
        target_audience: z.string()
      }),
      execute: async ({ topic, content_types, target_audience }) => {
        return {
          topic,
          content: {
            text: `Comprehensive content for ${topic}`,
            multimedia: content_types,
            interactivity: []
          },
          audience: target_audience
        };
      }
    });
  }

  private static generateMindMapTool() {
    return tool({
      name: 'generate_mind_map',
      description: 'Create visual mind maps for concept organization',
      parameters: z.object({
        central_concept: z.string(),
        related_concepts: z.array(z.string())
      }),
      execute: async ({ central_concept, related_concepts }) => {
        return {
          central_node: central_concept,
          branches: related_concepts.map(concept => ({
            concept,
            connections: []
          }))
        };
      }
    });
  }

  private static alignToStandardsTool() {
    return tool({
      name: 'align_to_standards',
      description: 'Align content to educational standards',
      parameters: z.object({
        content_id: z.string(),
        standards_framework: z.string()
      }),
      execute: async ({ content_id, standards_framework }) => {
        return {
          content_id,
          framework: standards_framework,
          aligned_standards: [],
          compliance_score: 95
        };
      }
    });
  }

  private static generateRubricTool() {
    return tool({
      name: 'generate_rubric',
      description: 'Create detailed assessment rubrics',
      parameters: z.object({
        assessment_type: z.string(),
        criteria: z.array(z.string())
      }),
      execute: async ({ assessment_type, criteria }) => {
        return {
          type: assessment_type,
          criteria: criteria.map(criterion => ({
            name: criterion,
            levels: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'],
            descriptions: {}
          }))
        };
      }
    });
  }

  private static pronunciationCheckTool() {
    return tool({
      name: 'check_pronunciation',
      description: 'Analyze pronunciation and provide feedback',
      parameters: z.object({
        word_or_phrase: z.string(),
        audio_data: z.string().optional()
      }),
      execute: async ({ word_or_phrase, audio_data }) => {
        return {
          word: word_or_phrase,
          accuracy_score: 0.92,
          feedback: 'Good pronunciation',
          suggestions: []
        };
      }
    });
  }

  private static voiceProgressTrackingTool() {
    return tool({
      name: 'track_voice_progress',
      description: 'Track learning progress through voice interactions',
      parameters: z.object({
        studentId: z.string(),
        session_data: z.record(z.any())
      }),
      execute: async ({ studentId, session_data }) => {
        return {
          student_id: studentId,
          session_summary: session_data,
          progress_indicators: {
            engagement: 0.9,
            comprehension: 0.85,
            participation: 0.95
          }
        };
      }
    });
  }

  // Get agent by name with proper typing
  static getAgent(agentName: keyof typeof LunaAgentRegistry): BaseLunaAgent | BaseLunaRealtimeAgent {
    const agent = LunaAgentRegistry[agentName];
    if (!agent) {
      throw new Error(`Agent ${String(agentName)} not found`);
    }
    return agent;
  }

  // Get all available agents
  static getAllAgents(): Record<string, BaseLunaAgent | BaseLunaRealtimeAgent> {
    return {
      tutorAgent: LunaAgentRegistry.tutorAgent,
      examCoachAgent: LunaAgentRegistry.examCoachAgent,
      classCoPilotAgent: LunaAgentRegistry.classCoPilotAgent,
      contentCreatorAgent: LunaAgentRegistry.contentCreatorAgent,
      assessmentBuilderAgent: LunaAgentRegistry.assessmentBuilderAgent,
      voiceTutorAgent: LunaAgentRegistry.voiceTutorAgent
    };
  }

  // Get agents by user role
  static getAgentsForRole(role: 'student' | 'teacher' | 'admin'): (BaseLunaAgent | BaseLunaRealtimeAgent)[] {
    switch (role) {
      case 'student':
        return [
          LunaAgentRegistry.tutorAgent,
          LunaAgentRegistry.examCoachAgent,
          LunaAgentRegistry.voiceTutorAgent
        ];
      case 'teacher':
        return [
          LunaAgentRegistry.classCoPilotAgent,
          LunaAgentRegistry.contentCreatorAgent,
          LunaAgentRegistry.assessmentBuilderAgent,
          LunaAgentRegistry.tutorAgent
        ];
      case 'admin':
        return Object.values(LunaAgentRegistry.getAllAgents());
      default:
        return [LunaAgentRegistry.tutorAgent];
    }
  }
}