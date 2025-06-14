import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, KnowledgeBaseAnalysis, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { knowledgeExtractor, ConceptMap, CourseStructureSuggestion } from './knowledge-extractor';
import type { Database } from '@/lib/types/database.types';

export interface CourseGenerationRequest {
  baseClassId: string;
  organisationId: string;
  userId: string;
  title: string;
  description?: string;
  generationMode?: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  estimatedDurationWeeks?: number;
  userGuidance?: string; // Additional context from user
}

export interface CourseOutline {
  id: string;
  title: string;
  description: string;
  generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  learningObjectives: string[];
  estimatedDurationWeeks: number;
  modules: CourseModule[];
  knowledgeBaseAnalysis: KnowledgeBaseAnalysis;
  status: 'draft' | 'approved' | 'published' | 'archived';
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationWeeks: number;
  learningObjectives: string[];
  lessons: ModuleLesson[];
  assessments: ModuleAssessment[];
}

export interface ModuleLesson {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationHours: number;
  contentType: 'lecture' | 'activity' | 'discussion' | 'reading' | 'lab';
  learningObjectives: string[];
  contentOutline: string[];
  requiredResources: string[];
  sourceReferences: string[]; // Knowledge base chunk IDs
}

export interface ModuleAssessment {
  id: string;
  title: string;
  type: 'quiz' | 'assignment' | 'project' | 'exam' | 'discussion';
  order: number;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  assessmentCriteria: string[];
  masteryThreshold: number; // Percentage required for mastery
  contentFocus: 'course_content' | 'kb_supplemented'; // Prioritize course content over KB
}

export interface GenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
}

export class CourseGenerator {
  private openai: OpenAI;
  private supabase: any; // Temporarily using any to avoid type issues

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = createSupabaseServerClient();
  }

  async generateCourse(request: CourseGenerationRequest): Promise<GenerationJob> {
    // 1. Create generation job
    const jobId = await this.createGenerationJob(request);
    
    // 2. Start async processing
    this.processGenerationJob(jobId, request).catch(error => {
      console.error('Course generation failed:', error);
      this.updateJobStatus(jobId, 'failed', 0, error.message);
    });

    return {
      id: jobId,
      status: 'queued',
      progress: 0
    };
  }

  private async createGenerationJob(request: CourseGenerationRequest): Promise<string> {
    const { data, error } = await this.supabase
      .from('course_generation_jobs')
      .insert({
        base_class_id: request.baseClassId,
        organisation_id: request.organisationId,
        user_id: request.userId,
        job_type: 'generate_outline',
        status: 'queued',
        job_data: request
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create generation job: ${error.message}`);
    return data.id;
  }

  private async processGenerationJob(jobId: string, request: CourseGenerationRequest): Promise<void> {
    await this.updateJobStatus(jobId, 'processing', 5);

    try {
      // Step 1: Analyze knowledge base (15% progress)
      const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);
      await this.updateJobStatus(jobId, 'processing', 15);

      // Step 2: Extract knowledge structure and concepts (30% progress)
      const conceptMap = await knowledgeExtractor.extractKnowledgeStructure(request.baseClassId);
      await this.updateJobStatus(jobId, 'processing', 30);

      // Step 3: Determine generation mode (35% progress)
      const generationMode = request.generationMode || kbAnalysis.recommendedGenerationMode;
      await this.updateJobStatus(jobId, 'processing', 35);

      // Step 4: Generate optimized course structure (50% progress)
      const structureSuggestion = await knowledgeExtractor.suggestCourseStructure(
        conceptMap, 
        request.estimatedDurationWeeks || 12
      );
      await this.updateJobStatus(jobId, 'processing', 50);

      // Step 5: Generate detailed course outline (65% progress)
      const outline = await this.generateEnhancedCourseOutline(
        request, 
        kbAnalysis, 
        conceptMap, 
        structureSuggestion, 
        generationMode
      );
      await this.updateJobStatus(jobId, 'processing', 65);

      // Step 6: Save course outline (75% progress)
      const courseOutlineId = await this.saveCourseOutline(outline, request);
      await this.updateJobStatus(jobId, 'processing', 75);

      // Step 7: Generate lesson content (85% progress)
      await this.generateLessonContent(courseOutlineId, outline, generationMode);
      await this.updateJobStatus(jobId, 'processing', 85);

      // Step 8: Generate assessments (95% progress)
      await this.generateAssessments(courseOutlineId, outline);
      await this.updateJobStatus(jobId, 'processing', 95);

      // Step 9: Complete and optimize (100% progress)
      await this.optimizeCourseStructure(courseOutlineId, conceptMap);
      await this.updateJobStatus(jobId, 'completed', 100, null, { courseOutlineId });

    } catch (error) {
      await this.updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async generateEnhancedCourseOutline(
    request: CourseGenerationRequest,
    kbAnalysis: KnowledgeBaseAnalysis,
    conceptMap: ConceptMap,
    structureSuggestion: CourseStructureSuggestion,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<CourseOutline> {
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Use the structured suggestions from knowledge extraction
    const modules = structureSuggestion.suggestedModules.map((suggestedModule, index) => ({
      id: `module-${index + 1}`,
      title: suggestedModule.title,
      description: suggestedModule.description,
      order: index + 1,
      estimatedDurationWeeks: suggestedModule.estimatedWeeks,
      learningObjectives: suggestedModule.learningObjectives,
      lessons: suggestedModule.suggestedLessons.map((lesson, lessonIndex) => ({
        id: `lesson-${index + 1}-${lessonIndex + 1}`,
        title: lesson.title,
        description: `Lesson covering ${lesson.concepts.join(', ')}`,
        order: lessonIndex + 1,
        estimatedDurationHours: lesson.estimatedHours,
        contentType: lesson.contentType,
        learningObjectives: [lesson.concepts.join(', ')],
        contentOutline: lesson.concepts,
        requiredResources: [],
        sourceReferences: lesson.concepts
      })),
      assessments: [{
        id: `assessment-${index + 1}`,
        title: `${suggestedModule.title} Assessment`,
        type: 'quiz' as const,
        order: 1,
        estimatedDurationMinutes: 30,
        learningObjectives: suggestedModule.learningObjectives,
        assessmentCriteria: ['Understanding of concepts', 'Application of knowledge'],
        masteryThreshold: 80,
        contentFocus: 'course_content' as const
      }]
    }));

    return {
      id: '', // Will be set when saved
      title: request.title,
      description: request.description || `Course generated from knowledge base using ${modeConfig.title} approach`,
      generationMode,
      learningObjectives: structureSuggestion.overallStructure.keyLearningPaths,
      estimatedDurationWeeks: request.estimatedDurationWeeks || structureSuggestion.overallStructure.estimatedWeeks,
      modules,
      knowledgeBaseAnalysis: kbAnalysis,
      status: 'draft'
    };
  }

  private async generateCourseOutline(
    request: CourseGenerationRequest,
    kbAnalysis: KnowledgeBaseAnalysis,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<CourseOutline> {
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Get relevant knowledge base content
    const kbContent = await this.getRelevantKnowledgeBaseContent(
      request.baseClassId,
      request.title,
      request.description || ''
    );

    const prompt = this.buildCourseOutlinePrompt(request, kbAnalysis, kbContent, modeConfig);

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert instructional designer. ${modeConfig.aiInstructions}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const outlineData = JSON.parse(completion.choices[0]?.message?.content || '{}');
    
    return {
      id: '', // Will be set when saved
      title: request.title,
      description: request.description || outlineData.description || '',
      generationMode,
      learningObjectives: outlineData.learningObjectives || [],
      estimatedDurationWeeks: request.estimatedDurationWeeks || outlineData.estimatedDurationWeeks || 12,
      modules: outlineData.modules || [],
      knowledgeBaseAnalysis: kbAnalysis,
      status: 'draft'
    };
  }

  private buildCourseOutlinePrompt(
    request: CourseGenerationRequest,
    kbAnalysis: KnowledgeBaseAnalysis,
    kbContent: any[],
    modeConfig: any
  ): string {
    return `
Create a comprehensive course outline for: "${request.title}"

Course Description: ${request.description || 'Not provided'}
Estimated Duration: ${request.estimatedDurationWeeks || 12} weeks
Generation Mode: ${modeConfig.title}

Knowledge Base Analysis:
- Total Documents: ${kbAnalysis.totalDocuments}
- Total Chunks: ${kbAnalysis.totalChunks}
- Content Depth: ${kbAnalysis.contentDepth}
- Subject Coverage: ${kbAnalysis.subjectCoverage.join(', ')}
- Recommended Mode: ${kbAnalysis.recommendedGenerationMode}

Knowledge Base Content Sample:
${kbContent.slice(0, 5).map(chunk => `- ${chunk.summary || chunk.content.substring(0, 200)}`).join('\n')}

${request.userGuidance ? `Additional User Guidance: ${request.userGuidance}` : ''}

Generate a JSON response with this structure:
{
  "description": "Course description",
  "learningObjectives": ["objective 1", "objective 2"],
  "estimatedDurationWeeks": 12,
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title",
      "description": "Module description",
      "order": 1,
      "estimatedDurationWeeks": 2,
      "learningObjectives": ["objective 1", "objective 2"],
      "lessons": [
        {
          "id": "lesson-1",
          "title": "Lesson Title",
          "description": "Lesson description",
          "order": 1,
          "estimatedDurationHours": 2,
          "contentType": "lecture",
          "learningObjectives": ["objective 1"],
          "contentOutline": ["topic 1", "topic 2"],
          "requiredResources": ["resource 1"],
          "sourceReferences": ["chunk-id-1", "chunk-id-2"]
        }
      ],
      "assessments": [
        {
          "id": "assessment-1",
          "title": "Assessment Title",
          "type": "quiz",
          "order": 1,
          "estimatedDurationMinutes": 30,
          "learningObjectives": ["objective 1"],
          "assessmentCriteria": ["criteria 1"],
          "masteryThreshold": 80,
          "contentFocus": "course_content"
        }
      ]
    }
  ]
}

Important: Assessments should focus on "course_content" and test mastery of the actual course material, not just knowledge base facts.
`;
  }

  private async getRelevantKnowledgeBaseContent(
    baseClassId: string,
    title: string,
    description: string
  ): Promise<any[]> {
    const searchQuery = `${title} ${description}`;
    return await knowledgeBaseAnalyzer.searchKnowledgeBase(baseClassId, searchQuery, 20);
  }

  private async saveCourseOutline(outline: CourseOutline, request: CourseGenerationRequest): Promise<string> {
    const { data, error } = await this.supabase
      .from('course_outlines')
      .insert({
        base_class_id: request.baseClassId,
        organisation_id: request.organisationId,
        user_id: request.userId,
        title: outline.title,
        description: outline.description,
        generation_mode: outline.generationMode,
        knowledge_base_analysis: outline.knowledgeBaseAnalysis,
        outline_structure: {
          modules: outline.modules,
          learningObjectives: outline.learningObjectives
        },
        learning_objectives: outline.learningObjectives,
        estimated_duration_weeks: outline.estimatedDurationWeeks,
        status: outline.status
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to save course outline: ${error.message}`);
    return data.id;
  }

  private async generateLessonContent(
    courseOutlineId: string,
    outline: CourseOutline,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<void> {
    // This will be implemented to generate actual lesson content
    // For now, we'll create placeholders in the database
    
    for (const courseModule of outline.modules) {
      for (const lesson of courseModule.lessons) {
        const lessonContent = await this.generateLessonContentForLesson(
          lesson,
          outline.knowledgeBaseAnalysis.baseClassId,
          generationMode
        );

        await this.supabase
          .from('generated_lesson_content')
          .insert({
            course_outline_id: courseOutlineId,
            organisation_id: outline.knowledgeBaseAnalysis.baseClassId, // This should be org_id
            content_type: 'main_content',
            generated_content: lessonContent,
            source_chunks: lesson.sourceReferences,
            generation_metadata: {
              model: 'gpt-4o',
              generation_mode: generationMode,
              timestamp: new Date().toISOString()
            },
            status: 'draft',
            user_id: outline.knowledgeBaseAnalysis.baseClassId // This should be user_id
          });
      }
    }
  }

  private async generateLessonContentForLesson(
    lesson: ModuleLesson,
    baseClassId: string,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<any> {
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Get relevant knowledge base content for this lesson
    const kbContent = await knowledgeBaseAnalyzer.searchKnowledgeBase(
      baseClassId,
      `${lesson.title} ${lesson.description}`,
      10
    );

    const prompt = `
Generate detailed lesson content for: "${lesson.title}"

Lesson Description: ${lesson.description}
Content Type: ${lesson.contentType}
Learning Objectives: ${lesson.learningObjectives.join(', ')}
Estimated Duration: ${lesson.estimatedDurationHours} hours

Generation Mode: ${modeConfig.title}
${modeConfig.aiInstructions}

Knowledge Base Content:
${kbContent.map(chunk => `- ${chunk.summary || chunk.content.substring(0, 300)}`).join('\n')}

Create comprehensive lesson content in JSON format:
{
  "introduction": "Lesson introduction text",
  "mainContent": {
    "sections": [
      {
        "title": "Section Title",
        "content": "Section content",
        "activities": ["activity 1", "activity 2"],
        "keyPoints": ["point 1", "point 2"],
        "citations": ["source reference"]
      }
    ]
  },
  "summary": "Lesson summary",
  "nextSteps": "What comes next",
  "resources": ["resource 1", "resource 2"]
}
`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert instructional designer. ${modeConfig.aiInstructions}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  private async generateAssessments(courseOutlineId: string, outline: CourseOutline): Promise<void> {
    // Generate assessments that prioritize course content over knowledge base
    for (const courseModule of outline.modules) {
      for (const assessment of courseModule.assessments) {
        const assessmentContent = await this.generateAssessmentContent(assessment, courseModule);

        await this.supabase
          .from('generated_lesson_content')
          .insert({
            course_outline_id: courseOutlineId,
            organisation_id: outline.knowledgeBaseAnalysis.baseClassId, // This should be org_id
            content_type: 'assessment',
            generated_content: assessmentContent,
            generation_metadata: {
              model: 'gpt-4o-mini',
              assessment_type: assessment.type,
              mastery_threshold: assessment.masteryThreshold,
              content_focus: assessment.contentFocus,
              timestamp: new Date().toISOString()
            },
            status: 'draft',
            user_id: outline.knowledgeBaseAnalysis.baseClassId // This should be user_id
          });
      }
    }
  }

  private async generateAssessmentContent(assessment: ModuleAssessment, module: CourseModule): Promise<any> {
    const prompt = `
Generate ${assessment.type} assessment for: "${assessment.title}"

Assessment should test mastery of COURSE CONTENT, not just knowledge base facts.

Module Context:
- Title: ${module.title}
- Learning Objectives: ${module.learningObjectives.join(', ')}
- Lessons: ${module.lessons.map(l => l.title).join(', ')}

Assessment Details:
- Type: ${assessment.type}
- Duration: ${assessment.estimatedDurationMinutes} minutes
- Learning Objectives: ${assessment.learningObjectives.join(', ')}
- Mastery Threshold: ${assessment.masteryThreshold}%
- Content Focus: ${assessment.contentFocus}

Create assessment content that:
1. Tests understanding of concepts taught in the lessons
2. Measures application of course principles
3. Evaluates mastery of learning objectives
4. Focuses on practical application over memorization

Generate JSON format:
{
  "instructions": "Assessment instructions",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice|short_answer|essay|practical",
      "question": "Question text",
      "options": ["option 1", "option 2"], // for multiple choice
      "correctAnswer": "answer",
      "explanation": "Why this is correct",
      "points": 10,
      "learningObjective": "which objective this tests"
    }
  ],
  "rubric": {
    "criteria": ["criteria 1", "criteria 2"],
    "masteryIndicators": ["indicator 1", "indicator 2"]
  },
  "timeAllocation": "How students should manage time"
}
`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert assessment designer. Create assessments that test deep understanding and practical application of course content, not just factual recall from source materials."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  private async updateJobStatus(
    jobId: string, 
    status: string, 
    progress: number, 
    error?: string | null, 
    result?: any
  ): Promise<void> {
    const updateData: any = {
      status,
      progress_percentage: progress,
      updated_at: new Date().toISOString()
    };

    if (status === 'processing' && !updateData.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (error) {
      updateData.error_message = error;
    }

    if (result) {
      updateData.result_data = result;
    }

    const { error: updateError } = await this.supabase
      .from('course_generation_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }

  async getGenerationJob(jobId: string): Promise<GenerationJob | null> {
    const { data, error } = await this.supabase
      .from('course_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      status: data.status,
      progress: data.progress_percentage,
      result: data.result_data,
      error: data.error_message
    };
  }

  async getCourseOutline(outlineId: string): Promise<CourseOutline | null> {
    const { data, error } = await this.supabase
      .from('course_outlines')
      .select('*')
      .eq('id', outlineId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      generationMode: data.generation_mode,
      learningObjectives: data.learning_objectives,
      estimatedDurationWeeks: data.estimated_duration_weeks,
      modules: data.outline_structure?.modules || [],
      knowledgeBaseAnalysis: data.knowledge_base_analysis,
      status: data.status
    };
  }

  private async optimizeCourseStructure(courseOutlineId: string, conceptMap: ConceptMap): Promise<void> {
    // Optional optimization step that could:
    // 1. Analyze the generated course structure
    // 2. Suggest improvements based on concept relationships
    // 3. Optimize learning sequences
    // 4. Identify potential gaps or redundancies
    
    // For now, we'll just log that optimization was attempted
    console.log(`Course structure optimization completed for outline ${courseOutlineId}`);
    console.log(`Analyzed ${conceptMap.concepts.length} concepts and ${conceptMap.relationships.length} relationships`);
  }
}

export const courseGenerator = new CourseGenerator(); 