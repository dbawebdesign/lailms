import { z } from 'zod';

// Base schemas for common structures
const CitationSchema = z.object({
  source: z.string(),
  url: z.string().url().optional(),
  page: z.number().optional(),
  paragraph: z.number().optional()
});

const KeyConceptSchema = z.object({
  concept: z.string().min(1),
  explanation: z.string().min(50),
  importance: z.enum(['critical', 'important', 'helpful']).optional()
});

const ExampleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50),
  code: z.string().optional(),
  language: z.string().optional(),
  output: z.string().optional()
});

// Lesson Section Content Schema
export const LessonSectionContentSchema = z.object({
  introduction: z.string().min(100, 'Introduction must be at least 100 characters'),
  detailed_explanation: z.string().min(500, 'Detailed explanation must be at least 500 characters'),
  key_concepts: z.array(KeyConceptSchema).min(1, 'At least one key concept is required'),
  examples: z.array(ExampleSchema).min(1, 'At least one example is required'),
  practical_applications: z.array(z.string()).optional(),
  common_misconceptions: z.array(z.object({
    misconception: z.string(),
    clarification: z.string()
  })).optional(),
  summary: z.string().min(50, 'Summary must be at least 50 characters'),
  citations: z.array(CitationSchema).optional()
});

// Assessment Question Schema
export const AssessmentQuestionSchema = z.object({
  question_text: z.string().min(10),
  question_type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'long_answer', 'coding']),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    is_correct: z.boolean()
  })).optional(),
  correct_answer: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
  explanation: z.string().min(50),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  points: z.number().positive(),
  grading_rubric: z.object({
    criteria: z.array(z.object({
      description: z.string(),
      points: z.number()
    }))
  }).optional(),
  sample_answer: z.string().optional()
});

// Assessment Generation Schema
export const AssessmentGenerationSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(50),
  instructions: z.string().min(50),
  questions: z.array(AssessmentQuestionSchema).min(3),
  total_points: z.number().positive(),
  time_limit_minutes: z.number().positive().optional(),
  passing_score_percentage: z.number().min(0).max(100)
});

// Brain Bytes Script Schema
export const BrainBytesScriptSchema = z.object({
  title: z.string().min(5),
  hook: z.string().min(50, 'Hook must grab attention in first 10 seconds'),
  main_content: z.array(z.object({
    segment: z.string().min(50),
    duration_seconds: z.number().positive()
  })).min(3),
  key_takeaways: z.array(z.string()).min(2),
  call_to_action: z.string().min(20),
  total_duration_seconds: z.number().min(30).max(180), // 30s to 3min
  tone: z.enum(['casual', 'professional', 'enthusiastic', 'calm'])
});

// Mind Map Schema
export const MindMapGenerationSchema = z.object({
  central_topic: z.string(),
  main_branches: z.array(z.object({
    title: z.string(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    sub_branches: z.array(z.object({
      title: z.string(),
      details: z.string().optional(),
      connections: z.array(z.string()).optional()
    }))
  })).min(3),
  relationships: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['relates_to', 'depends_on', 'contrasts_with', 'leads_to'])
  })).optional()
});

// Course Outline Schema
export const CourseOutlineGenerationSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(100),
  learning_objectives: z.array(z.string()).min(3),
  prerequisites: z.string().optional(),
  target_audience: z.string(),
  estimated_duration_weeks: z.number().positive(),
  paths: z.array(z.object({
    title: z.string(),
    description: z.string(),
    order_index: z.number(),
    lessons: z.array(z.object({
      title: z.string(),
      description: z.string(),
      order_index: z.number(),
      estimated_time_minutes: z.number().positive(),
      sections: z.array(z.object({
        title: z.string(),
        type: z.string()
      }))
    }))
  })).min(1)
});

// Quality Evaluation Schema
export const QualityEvaluationSchema = z.object({
  overall_score: z.number().min(0).max(1),
  criteria_scores: z.object({
    accuracy: z.number().min(0).max(1),
    completeness: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    engagement: z.number().min(0).max(1),
    pedagogical_value: z.number().min(0).max(1)
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  recommendations: z.array(z.string()).optional()
});

// Type exports
export type LessonSectionContent = z.infer<typeof LessonSectionContentSchema>;
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;
export type AssessmentGeneration = z.infer<typeof AssessmentGenerationSchema>;
export type BrainBytesScript = z.infer<typeof BrainBytesScriptSchema>;
export type MindMapGeneration = z.infer<typeof MindMapGenerationSchema>;
export type CourseOutlineGeneration = z.infer<typeof CourseOutlineGenerationSchema>;
export type QualityEvaluation = z.infer<typeof QualityEvaluationSchema>;

// Validation helper with detailed error messages
export function validateWithDetails<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}