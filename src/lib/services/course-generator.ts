import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, KnowledgeBaseAnalysis, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { knowledgeExtractor, ConceptMap, CourseStructureSuggestion } from './knowledge-extractor';
import type { Database } from '@learnologyai/types';
import { AssessmentGenerationService } from './assessment-generation-service';

export interface CourseGenerationRequest {
  baseClassId: string;
  organisationId: string;
  userId: string;
  title: string;
  description?: string;
  generationMode?: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  estimatedDurationWeeks?: number;
  academicLevel?: 'kindergarten' | '1st-grade' | '2nd-grade' | '3rd-grade' | '4th-grade' | '5th-grade' | '6th-grade' | '7th-grade' | '8th-grade' | '9th-grade' | '10th-grade' | '11th-grade' | '12th-grade' | 'college' | 'graduate' | 'professional' | 'master';
  lessonDetailLevel?: 'basic' | 'detailed' | 'comprehensive';
  targetAudience?: string;
  prerequisites?: string;
  lessonsPerWeek?: number;
  learningObjectives?: string[];
  assessmentSettings?: {
    includeAssessments: boolean; // Lesson-level assessments (knowledge checks)
    includeQuizzes: boolean; // Path-level quizzes (cumulative for modules)
    includeFinalExam: boolean; // Class-level exams (comprehensive)
    assessmentDifficulty?: 'easy' | 'medium' | 'hard';
    questionsPerLesson?: number; // Number of questions per lesson assessment
    questionsPerQuiz?: number; // Number of questions per path quiz
    questionsPerExam?: number; // Number of questions per class exam
  };
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
  // Configuration parameters
  academicLevel?: 'kindergarten' | '1st-grade' | '2nd-grade' | '3rd-grade' | '4th-grade' | '5th-grade' | '6th-grade' | '7th-grade' | '8th-grade' | '9th-grade' | '10th-grade' | '11th-grade' | '12th-grade' | 'college' | 'graduate' | 'professional' | 'master';
  lessonDetailLevel?: 'basic' | 'detailed' | 'comprehensive';
  targetAudience?: string;
  prerequisites?: string;
  lessonsPerWeek?: number;
  assessmentSettings?: {
    includeAssessments: boolean;
    includeQuizzes: boolean;
    includeFinalExam: boolean;
  };
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
  private assessmentGenerator: AssessmentGenerationService;
  private kbContentCache: Map<string, any[]> = new Map(); // Cache for KB content to avoid repeated searches

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.assessmentGenerator = new AssessmentGenerationService();
  }

  private getSupabaseClient() {
    return createSupabaseServerClient();
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
    const supabase = this.getSupabaseClient();
    const { data, error } = await (supabase as any)
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
      // Use fast-path generation for better performance
      const useFastPath = true; // TODO: Make this configurable
      
      if (useFastPath) {
        // Fast-path: Skip expensive analysis, generate directly from KB content
        await this.processFastPathGeneration(jobId, request);
      } else {
        // Original full analysis path (slow but comprehensive)
        await this.processFullAnalysisGeneration(jobId, request);
      }

    } catch (error) {
      await this.updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async processFastPathGeneration(jobId: string, request: CourseGenerationRequest): Promise<void> {
    // Step 1: Quick knowledge base analysis (15% progress)
    const kbAnalysis = await knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId);
    await this.updateJobStatus(jobId, 'processing', 15);

    // Step 2: Determine generation mode (25% progress)
    const generationMode = request.generationMode || kbAnalysis.recommendedGenerationMode;
    await this.updateJobStatus(jobId, 'processing', 25);

    // Step 3: Generate course outline directly (45% progress)
    const outline = await this.generateCourseOutline(request, kbAnalysis, generationMode);
    await this.updateJobStatus(jobId, 'processing', 45);

    // Step 4: Save course outline (55% progress)
    const courseOutlineId = await this.saveCourseOutline(outline, request);
    await this.updateJobStatus(jobId, 'processing', 55);

    // Step 5: Create actual LMS entities (paths, lessons, sections, assessments) (70% progress)
    await this.createLMSEntitiesOptimized(courseOutlineId, outline, request);
    await this.updateJobStatus(jobId, 'processing', 70);

    // Step 6: Generate comprehensive lesson content (85% progress)
    await this.generateComprehensiveLessonContent(courseOutlineId, outline, generationMode, request);
    await this.updateJobStatus(jobId, 'processing', 85);

    // Step 7: Assessments are now generated within createLMSEntities, so this step is removed.
    // await this.generateAssessments(courseOutlineId, outline, request);
    
    await this.updateJobStatus(jobId, 'processing', 95);

    // Step 8: Complete (100% progress)
    await this.updateJobStatus(jobId, 'completed', 100, null, { courseOutlineId });
  }

  private async processFullAnalysisGeneration(jobId: string, request: CourseGenerationRequest): Promise<void> {
    try {
      await this.updateJobStatus(jobId, 'processing', 10);

      // Run knowledge base analysis and get relevant content in parallel
      const [kbAnalysis, kbContentPromise] = await Promise.all([
        knowledgeBaseAnalyzer.analyzeKnowledgeBase(request.baseClassId),
        this.getRelevantKnowledgeBaseContent(
          request.baseClassId,
          request.title,
          request.description || '',
          request.generationMode
        )
      ]);

      await this.updateJobStatus(jobId, 'processing', 25);

      // Generate course outline directly without concept map and structure suggestion
      // (These methods don't exist in KnowledgeBaseAnalyzer)
      const outline = await this.generateCourseOutline(
        request,
        kbAnalysis,
        request.generationMode || 'kb_priority'
      );

      await this.updateJobStatus(jobId, 'processing', 40);

      await this.updateJobStatus(jobId, 'processing', 60);

      // Save course outline
      const outlineId = await this.saveCourseOutline(outline, request);

      await this.updateJobStatus(jobId, 'processing', 70);

      // Create LMS entities (paths, lessons, sections, assessments)
      await this.createLMSEntitiesOptimized(outlineId, outline, request);

      await this.updateJobStatus(jobId, 'processing', 85);

      // Optional: Generate lesson content and assessments
      // These are now created directly in createLMSEntities
      
      await this.updateJobStatus(jobId, 'processing', 95);

      // Finalize
      await this.updateJobStatus(jobId, 'completed', 100, null, {
        courseOutlineId: outlineId,
        message: 'Course generation completed successfully',
        stats: {
          modules: outline.modules.length,
          totalLessons: outline.modules.reduce((sum, m) => sum + m.lessons.length, 0),
          totalSections: outline.modules.reduce((sum, m) => 
            sum + m.lessons.reduce((lessonSum, l) => lessonSum + (l.contentOutline?.length || 0), 0), 0
          )
        }
      });
    } catch (error) {
      console.error('Full analysis generation failed:', error);
      await this.updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : String(error));
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
      status: 'draft',
      academicLevel: request.academicLevel,
      lessonDetailLevel: request.lessonDetailLevel,
      targetAudience: request.targetAudience,
      prerequisites: request.prerequisites,
      lessonsPerWeek: request.lessonsPerWeek,
      assessmentSettings: request.assessmentSettings
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
      request.description || '',
      generationMode
    );

    const prompt = this.buildCourseOutlinePrompt(request, kbAnalysis, kbContent, modeConfig);

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
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
    
    // Map real chunk IDs to lessons
    const chunkIds = kbContent.map(chunk => chunk.id).filter(id => this.isValidUUID(id));
    const chunksPerLesson = Math.max(1, Math.floor(chunkIds.length / (outlineData.modules?.length || 1)));
    
    // Update modules with real chunk IDs
    const modules = (outlineData.modules || []).map((module: any, moduleIndex: number) => ({
      ...module,
      lessons: (module.lessons || []).map((lesson: any, lessonIndex: number) => {
        const startIndex = (moduleIndex * chunksPerLesson + lessonIndex) % chunkIds.length;
        const lessonChunks = chunkIds.slice(startIndex, startIndex + Math.min(3, chunkIds.length));
        return {
          ...lesson,
          sourceReferences: lessonChunks
        };
      })
    }));
    
    return {
      id: '', // Will be set when saved
      title: request.title,
      description: request.description || outlineData.description || '',
      generationMode,
      learningObjectives: outlineData.learningObjectives || [],
      estimatedDurationWeeks: request.estimatedDurationWeeks || outlineData.estimatedDurationWeeks || 12,
      modules,
      knowledgeBaseAnalysis: kbAnalysis,
      status: 'draft',
      academicLevel: request.academicLevel,
      lessonDetailLevel: request.lessonDetailLevel,
      targetAudience: request.targetAudience,
      prerequisites: request.prerequisites,
      lessonsPerWeek: request.lessonsPerWeek,
      assessmentSettings: request.assessmentSettings
    };
  }

  private buildCourseOutlinePrompt(
    request: CourseGenerationRequest,
    kbAnalysis: KnowledgeBaseAnalysis,
    kbContent: any[],
    modeConfig: any
  ): string {
    const totalLessons = (request.estimatedDurationWeeks || 12) * (request.lessonsPerWeek || 2);
    const lessonsPerModule = Math.ceil(totalLessons / (request.estimatedDurationWeeks || 12));

    return `
You are an expert instructional designer creating a comprehensive educational course.

COURSE CONFIGURATION:
- Title: ${request.title}
- Description: ${request.description || 'Not provided'}
- Duration: ${request.estimatedDurationWeeks || 12} weeks
- Modules: ${request.estimatedDurationWeeks || 12} (one module per week)
- Lessons per Week: ${request.lessonsPerWeek || 2}
- Total Lessons: ${totalLessons}
- Academic Level: ${request.academicLevel || 'college'}
- Content Depth: ${request.lessonDetailLevel || 'detailed'}
- Target Audience: ${request.targetAudience || 'General learners'}
- Prerequisites: ${request.prerequisites || 'None specified'}
- Generation Mode: ${modeConfig.title}

ASSESSMENT CONFIGURATION:
- Lesson Assessments: ${request.assessmentSettings?.includeAssessments !== false ? 'Yes' : 'No'}
- Module Quizzes: ${request.assessmentSettings?.includeQuizzes !== false ? 'Yes' : 'No'}
- Final Exam: ${request.assessmentSettings?.includeFinalExam !== false ? 'Yes' : 'No'}

${this.getAcademicLevelGuidance(request.academicLevel)}

${this.getLessonDetailGuidance(request.lessonDetailLevel)}

KNOWLEDGE BASE ANALYSIS:
- Documents: ${kbAnalysis.totalDocuments}
- Content Chunks: ${kbAnalysis.totalChunks}
- Content Depth: ${kbAnalysis.contentDepth}
- Subject Areas: ${kbAnalysis.subjectCoverage.join(', ')}

KNOWLEDGE BASE CONTENT SAMPLE:
${kbContent.slice(0, 10).map(chunk => `- ${chunk.summary || chunk.content.substring(0, 300)}`).join('\n')}

${request.userGuidance ? `\nADDITIONAL GUIDANCE:\n${request.userGuidance}` : ''}

CRITICAL INSTRUCTIONS FOR COURSE STRUCTURE:
1. Create EXACTLY ${request.estimatedDurationWeeks || 12} modules (one per week)
2. Each module should contain approximately ${lessonsPerModule} lessons
3. Design a logical, progressive learning path where each module builds on the previous
4. Ensure the course takes learners from foundational concepts to mastery
5. Create actual educational content plans, not just topic outlines
6. Focus on teaching and knowledge transfer, not just information listing

EDUCATIONAL CONTENT REQUIREMENTS:
- Each lesson must have clear, measurable learning objectives
- Content must be designed to actively teach, not just present information
- Include varied instructional approaches (lectures, activities, discussions, etc.)
- Ensure depth and breadth appropriate for the academic level
- Plan for student engagement and active learning throughout

Generate a comprehensive course outline in JSON format:
{
  "description": "Comprehensive course description explaining what students will learn and achieve",
  "learningObjectives": [
    "Students will be able to...",
    "Students will master...",
    "Students will understand..."
  ],
  "estimatedDurationWeeks": ${request.estimatedDurationWeeks || 12},
  "modules": [
    {
      "id": "module-1",
      "title": "Week 1: [Descriptive Module Title]",
      "description": "Detailed description of what will be taught this week",
      "order": 1,
      "estimatedDurationWeeks": 1,
      "learningObjectives": [
        "Specific, measurable objective 1",
        "Specific, measurable objective 2"
      ],
      "lessons": [
        {
          "id": "lesson-1-1",
          "title": "[Specific Lesson Title]",
          "description": "What this lesson will teach and how",
          "order": 1,
          "estimatedDurationHours": 2,
          "contentType": "lecture|activity|discussion|reading|lab",
          "learningObjectives": ["What students will learn"],
          "contentOutline": [
            "Major topic/concept to teach",
            "Key skill to develop",
            "Important principle to understand"
          ],
          "requiredResources": ["Specific resources needed"]
        }
      ],
      "assessments": [
        {
          "id": "assessment-1",
          "title": "Week 1 Quiz",
          "type": "quiz",
          "order": 1,
          "estimatedDurationMinutes": 30,
          "learningObjectives": ["What this assessment measures"],
          "assessmentCriteria": ["How mastery is evaluated"],
          "masteryThreshold": 80,
          "contentFocus": "course_content"
        }
      ]
    }
  ]
}

Remember: This is an EDUCATIONAL course that must TEACH students, not just list topics. Every element should contribute to actual learning and skill development.`;
  }

  private async getRelevantKnowledgeBaseContent(
    baseClassId: string,
    title: string,
    description: string,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented' = 'kb_supplemented'
  ): Promise<any[]> {
    const searchQuery = `${title} ${description}`;
    return await knowledgeBaseAnalyzer.searchKnowledgeBaseForGeneration(
      baseClassId, 
      searchQuery, 
      generationMode,
      { courseScope: 'outline' }
    );
  }

  private async saveCourseOutline(outline: CourseOutline, request: CourseGenerationRequest): Promise<string> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await (supabase as any)
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
        status: outline.status,
        academic_level: outline.academicLevel,
        lesson_detail_level: outline.lessonDetailLevel,
        target_audience: outline.targetAudience,
        prerequisites: outline.prerequisites,
        lessons_per_week: outline.lessonsPerWeek,
        assessment_settings: outline.assessmentSettings
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to save course outline: ${error.message}`);
    return data.id;
  }

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private async generateLessonContent(
    courseOutlineId: string,
    outline: CourseOutline,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented',
    request: CourseGenerationRequest
  ): Promise<void> {
    // Pre-fetch and cache KB content once for the entire course to avoid repeated searches
    const cacheKey = `${outline.knowledgeBaseAnalysis.baseClassId}-${generationMode}`;
    if (!this.kbContentCache.has(cacheKey)) {
      console.log('🔍 Fetching KB content for course-wide use...');
      const courseKbContent = await knowledgeBaseAnalyzer.searchKnowledgeBaseForGeneration(
        outline.knowledgeBaseAnalysis.baseClassId,
        `${request.title} ${request.description || ''}`,
        generationMode,
        { courseScope: 'outline' }
      );
      this.kbContentCache.set(cacheKey, courseKbContent);
      console.log(`📚 Cached ${courseKbContent.length} KB chunks for course generation`);
    }
    
    // Note: Educational content generation has been moved to lesson sections
    // This method now only handles KB content caching for later use in section generation
    // All actual teaching content is generated in createLessonSectionsWithComprehensiveContent
    
    console.log('✅ Course-level KB content cached. Educational content will be generated per lesson section.');
    
    // Clear cache after course generation to prevent memory leaks
    this.kbContentCache.clear();
    console.log('🧹 Cleared KB content cache after course generation');
  }

  private async generateComprehensiveLessonContent(
    courseOutlineId: string,
    outline: CourseOutline,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented',
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log('🎓 Starting comprehensive lesson content generation...');
    
    // Pre-fetch and cache KB content once for the entire course
    const cacheKey = `${outline.knowledgeBaseAnalysis.baseClassId}-${generationMode}`;
    if (!this.kbContentCache.has(cacheKey)) {
      console.log('🔍 Fetching KB content for comprehensive content generation...');
      const courseKbContent = await knowledgeBaseAnalyzer.searchKnowledgeBaseForGeneration(
        outline.knowledgeBaseAnalysis.baseClassId,
        `${request.title} ${request.description || ''}`,
        generationMode,
        { courseScope: 'outline' }
      );
      this.kbContentCache.set(cacheKey, courseKbContent);
      console.log(`📚 Cached ${courseKbContent.length} KB chunks for comprehensive generation`);
    }

    try {
      const supabase = this.getSupabaseClient();
      
      // Get all lessons that were created for this course
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title, description, path_id')
        .eq('base_class_id', request.baseClassId)
        .order('order_index');

      if (lessonsError || !lessons) {
        console.error('Failed to fetch lessons for content generation:', lessonsError);
        return;
      }

      console.log(`🔄 Generating comprehensive content for ${lessons.length} lessons...`);

      // Process lessons in batches to avoid overwhelming the API
      const batchSize = 3; // Process 3 lessons at a time
      for (let i = 0; i < lessons.length; i += batchSize) {
        const batch = lessons.slice(i, i + batchSize);
        console.log(`📝 Processing lesson batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(lessons.length/batchSize)}`);

        const batchPromises = batch.map(async (lesson) => {
          try {
            // Find the corresponding lesson outline from the course outline
            const moduleLesson = this.findLessonInOutline(outline, lesson.title);
            if (!moduleLesson) {
              console.warn(`Could not find lesson outline for: ${lesson.title}`);
              return;
            }

            console.log(`🎯 Generating content for lesson: ${lesson.title}`);
            await this.createLessonSectionsWithComprehensiveContent(
              lesson.id,
              moduleLesson,
              request,
              outline,
              generationMode
            );
            console.log(`✅ Completed content generation for: ${lesson.title}`);
          } catch (error) {
            console.error(`❌ Failed to generate content for lesson ${lesson.title}:`, error);
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < lessons.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('✅ Comprehensive lesson content generation completed!');
    } finally {
      // Clear cache after course generation to prevent memory leaks
      this.kbContentCache.clear();
      console.log('🧹 Cleared KB content cache after comprehensive generation');
    }
  }

  private findLessonInOutline(outline: CourseOutline, lessonTitle: string): ModuleLesson | null {
    for (const module of outline.modules) {
      for (const lesson of module.lessons) {
        if (lesson.title === lessonTitle) {
          return lesson;
        }
      }
    }
    return null;
  }

  private async generateLessonContentForLesson(
    lesson: ModuleLesson,
    baseClassId: string,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented',
    outline: CourseOutline
  ): Promise<any> {
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Use cached KB content instead of making individual searches per lesson
    const cacheKey = `${baseClassId}-${generationMode}`;
    let kbContent = this.kbContentCache.get(cacheKey) || [];
    
    // Filter cached content to be more relevant to this specific lesson
    const lessonKeywords = `${lesson.title} ${lesson.description} ${lesson.learningObjectives.join(' ')}`.toLowerCase();
    const relevantKbContent = kbContent.filter(chunk => {
      const chunkText = (chunk.summary || chunk.content || '').toLowerCase();
      return lesson.learningObjectives.some(objective => 
        chunkText.includes(objective.toLowerCase()) ||
        lessonKeywords.split(' ').some(keyword => keyword.length > 3 && chunkText.includes(keyword))
      );
    }).slice(0, 10); // Limit to top 10 most relevant chunks
    
    // Use the filtered content, or fall back to all cached content if no specific matches
    const finalKbContent = relevantKbContent.length > 0 ? relevantKbContent : kbContent.slice(0, 15);

    const prompt = `
You are a master educator creating comprehensive lesson content that will TEACH students, not just inform them.

LESSON DETAILS:
- Title: ${lesson.title}
- Description: ${lesson.description}
- Type: ${lesson.contentType}
- Learning Objectives: ${lesson.learningObjectives.join(', ')}
- Duration: ${lesson.estimatedDurationHours} hours

COURSE CONTEXT:
- Academic Level: ${outline.academicLevel || 'college'}
- Content Depth: ${outline.lessonDetailLevel || 'detailed'}
- Target Audience: ${outline.targetAudience || 'General learners'}
- Prerequisites: ${outline.prerequisites || 'None specified'}

${this.getAcademicLevelGuidance(outline.academicLevel)}

${this.getLessonDetailGuidance(outline.lessonDetailLevel)}

GENERATION MODE: ${modeConfig.title}
${modeConfig.aiInstructions}

KNOWLEDGE BASE CONTENT:
${finalKbContent.map(chunk => `- ${chunk.summary || chunk.content.substring(0, 500)}`).join('\n')}

CRITICAL INSTRUCTIONS FOR EDUCATIONAL CONTENT:
1. Create content that ACTIVELY TEACHES, not just presents information
2. Use the "I do, We do, You do" gradual release model
3. Start with clear learning objectives and connect all content back to them
4. Include multiple examples, demonstrations, and practice opportunities
5. Anticipate common misconceptions and address them proactively
6. Use analogies, stories, and real-world connections
7. Build knowledge progressively within the lesson
8. Include checks for understanding throughout
9. Provide clear explanations as if you're a patient teacher in a 1-on-1 setting
10. Make the content engaging and memorable

Generate comprehensive educational lesson content in JSON format:
{
  "introduction": "Engaging lesson introduction that includes: attention-grabbing hook, clear learning objectives presentation, activation of prior knowledge, and lesson roadmap. Should be 2-3 substantial paragraphs that set up the entire lesson.",
    "sections": [
      {
        "title": "Clear, Descriptive Section Title",
      "content": "Comprehensive educational content that explains, demonstrates, and teaches the concept thoroughly. This should be several detailed paragraphs of actual teaching content that progressively builds understanding. Include explanations, demonstrations, and guided discovery as appropriate.",
        "examples": [
          {
            "type": "worked_example|real_world|analogy",
          "description": "Detailed example that illuminates the concept with step-by-step explanation"
        }
      ],
      "key_points": ["Essential takeaways from this section that students must understand"],
      "common_misconceptions": ["Things students often get wrong with explanations of why"],
      "check_understanding": ["Specific questions or activities to verify comprehension before moving on"]
    }
  ],
  "activities": [
    {
      "type": "guided_practice|independent_practice|discussion|reflection",
      "title": "Activity Name",
      "instructions": "Clear, detailed directions for the activity including expected outcomes",
      "duration": "Estimated time",
      "scaffolding": "How to support students who need help",
      "differentiation": "How to adjust for different skill levels"
    }
  ],
  "summary": "Comprehensive review that synthesizes all key concepts, explicitly connects back to learning objectives, and includes a meaningful closure activity. Should be 2-3 paragraphs that help students consolidate their learning.",
  "assessment_opportunities": [
    {
      "type": "formative|summative",
      "description": "Specific way to assess student understanding",
      "criteria": "What successful completion looks like"
    }
  ],
  "extension_support": {
    "enrichment": ["Activities for students who master content quickly"],
    "remediation": ["Additional support strategies for struggling students"],
    "real_world_connections": ["How this lesson applies beyond the classroom"]
  },
  "required_resources": ["Essential materials, tools, or technologies needed"],
  "supplementary_resources": ["Additional resources for deeper learning"]
}

Remember: Every element should contribute to TEACHING and helping students achieve mastery. Focus on creating actual educational content that guides learning, not just information delivery.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a master educator creating comprehensive lesson sections. ${modeConfig.aiInstructions} 
          
          Create detailed educational content for ${outline.academicLevel || 'college'} level learners with ${outline.lessonDetailLevel || 'detailed'} depth. 
          Your content should actively teach and guide student learning progressively.
          Target audience: ${outline.targetAudience || 'General learners'}.
          Prerequisites: ${outline.prerequisites || 'None specified'}.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 16000
    });

    try {
      const content = completion.choices[0]?.message?.content || '{}';
      const parsedContent = JSON.parse(content);
      
      // Validate that we have the essential structure
      if (!parsedContent.introduction || !parsedContent.sections || !Array.isArray(parsedContent.sections)) {
        console.warn('Generated content missing essential structure, using fallback');
        return this.createFallbackLessonContent(lesson);
      }
      
      return parsedContent;
    } catch (parseError) {
      console.error('Failed to parse lesson content JSON:', parseError);
      console.log('Raw content length:', completion.choices[0]?.message?.content?.length);
      console.log('Raw content preview:', completion.choices[0]?.message?.content?.substring(0, 500));
      
      // Try to repair common JSON issues
      const repairedContent = this.repairJsonContent(completion.choices[0]?.message?.content || '{}');
      if (repairedContent) {
        return repairedContent;
      }
      
      // Return a structured fallback to prevent total failure
      return this.createFallbackLessonContent(lesson);
    }
  }

  private repairJsonContent(rawContent: string): any | null {
    try {
      // Remove common markdown formatting
      let cleaned = rawContent.replace(/```json\s*|\s*```/g, '');
      
      // Try to fix unterminated strings by finding the last complete object
      const lastCompleteObject = cleaned.lastIndexOf('}');
      if (lastCompleteObject > 0) {
        cleaned = cleaned.substring(0, lastCompleteObject + 1);
      }
      
      // Attempt to parse the cleaned content
      const parsed = JSON.parse(cleaned);
      
      // Validate essential structure
      if (parsed.introduction && parsed.sections && Array.isArray(parsed.sections)) {
        console.log('Successfully repaired JSON content');
        return parsed;
      }
    } catch (repairError) {
      console.error('JSON repair failed:', repairError);
    }
    
    return null;
  }

  private createFallbackLessonContent(lesson: ModuleLesson): any {
      return {
      introduction: `This lesson covers ${lesson.title}. ${lesson.description} By the end of this lesson, students will be able to: ${lesson.learningObjectives.join(', ')}.`,
      sections: [
        {
          title: lesson.title,
          content: `${lesson.description} This section will cover the fundamental concepts and provide practical examples to help students understand the material.`,
          examples: [
            {
              type: "practical",
              description: "Real-world application of the concepts covered in this lesson"
            }
          ],
          key_points: lesson.learningObjectives,
          common_misconceptions: ["Common misunderstandings will be addressed as they arise"],
          check_understanding: ["Students will demonstrate understanding through practice exercises"]
        }
      ],
      activities: [
        {
          type: "guided_practice",
          title: "Practice Activity",
          instructions: "Students will practice the concepts learned in this lesson with instructor guidance",
          duration: "15 minutes",
          scaffolding: "Instructor provides support as needed",
          differentiation: "Activities can be adjusted based on student needs"
        }
      ],
      summary: `This lesson covered ${lesson.title}. Students should now understand: ${lesson.learningObjectives.join(', ')}. These concepts will be built upon in future lessons.`,
      assessment_opportunities: [
        {
          type: "formative",
          description: "Quick check for understanding through questioning and observation",
          criteria: "Students can explain key concepts and apply them in practice"
        }
      ],
      extension_support: {
        enrichment: ["Additional challenging problems for advanced students"],
        remediation: ["Extra practice and support for students who need it"],
        real_world_connections: ["Examples of how this lesson applies to real-world situations"]
      },
      required_resources: lesson.requiredResources || ["Standard classroom materials"],
      supplementary_resources: ["Additional reading materials and online resources"]
    };
  }

  /**
   * Create lesson assessments using the new AssessmentGenerationService
   */
  private async createLessonAssessmentsBatch(
    lessonId: string,
    lesson: any,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeAssessments) return;

    try {
      console.log(`🎯 Generating assessment for lesson: ${lesson.title}`);

      // Use the new assessment generation service
      const questionsPerLesson = request.assessmentSettings?.questionsPerLesson || 5;
      const assessmentParams = {
        scope: 'lesson' as const,
        scopeId: lessonId,
        baseClassId: request.baseClassId,
        questionCount: questionsPerLesson,
        assessmentTitle: `${lesson.title} - Knowledge Check`,
        assessmentDescription: `Assessment covering key concepts from: ${lesson.description}`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 30, // 30 minutes for lesson assessments
        passingScore: 70,
        onProgress: (message: string) => console.log(`📝 Assessment Generation: ${message}`)
      };

      const assessment = await this.assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created assessment with ${questionsPerLesson} questions for lesson: ${lesson.title}`);

    } catch (error) {
      console.error('Failed to create lesson assessments:', error);
      // Don't throw error to prevent course generation from failing
    }
  }

  /**
   * Create path-level quizzes using the new AssessmentGenerationService
   */
  private async createPathQuiz(
    pathId: string,
    pathTitle: string,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeQuizzes) return;

    try {
      console.log(`🎯 Generating quiz for path: ${pathTitle}`);

      const questionsPerQuiz = request.assessmentSettings?.questionsPerQuiz || 10;
      const assessmentParams = {
        scope: 'path' as const,
        scopeId: pathId,
        baseClassId: request.baseClassId,
        questionCount: questionsPerQuiz,
        assessmentTitle: `${pathTitle} - Module Quiz`,
        assessmentDescription: `Comprehensive quiz covering all lessons in: ${pathTitle}`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 60, // 60 minutes for path quizzes
        passingScore: 75,
        onProgress: (message: string) => console.log(`📝 Quiz Generation: ${message}`)
      };

      const assessment = await this.assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created quiz with ${questionsPerQuiz} questions for path: ${pathTitle}`);

    } catch (error) {
      console.error('Failed to create path quiz:', error);
      // Don't throw error to prevent course generation from failing
    }
  }

  /**
   * Create class-level final exam using the new AssessmentGenerationService
   */
  private async createClassExam(
    baseClassId: string,
    classTitle: string,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeFinalExam) return;

    try {
      console.log(`🎯 Generating final exam for class: ${classTitle}`);

      const questionsPerExam = request.assessmentSettings?.questionsPerExam || 25;
      const assessmentParams = {
        scope: 'class' as const,
        scopeId: baseClassId,
        baseClassId: baseClassId,
        questionCount: questionsPerExam,
        assessmentTitle: `${classTitle} - Final Exam`,
        assessmentDescription: `Comprehensive final exam covering all course material from: ${classTitle}`,
        questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
        difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
        timeLimit: 120, // 120 minutes for final exams
        passingScore: 70,
        onProgress: (message: string) => console.log(`📝 Final Exam Generation: ${message}`)
      };

      const assessment = await this.assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created final exam with ${questionsPerExam} questions for class: ${classTitle}`);

    } catch (error) {
      console.error('Failed to create class exam:', error);
      // Don't throw error to prevent course generation from failing
    }
  }

  /**
   * Get appropriate question types based on academic level
   */
  private getQuestionTypesForLevel(academicLevel?: string): ('multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching')[] {
    if (!academicLevel) return ['multiple_choice', 'true_false', 'short_answer'];
    
    const level = academicLevel.toLowerCase();
    
    // Elementary levels (K-5)
    if (level.includes('kindergarten') || level.includes('1st') || level.includes('2nd') || 
        level.includes('3rd') || level.includes('4th') || level.includes('5th')) {
      return ['multiple_choice', 'true_false', 'matching'];
    }
    
    // Middle school (6-8)
    if (level.includes('6th') || level.includes('7th') || level.includes('8th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'matching'];
    }
    
    // High school (9-12)
    if (level.includes('9th') || level.includes('10th') || level.includes('11th') || level.includes('12th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'essay'];
    }
    
    // College and beyond
    return ['multiple_choice', 'short_answer', 'essay'];
  }

  // Helper method to combine lesson section content
  private combineLessonSectionContent(lessonSections: any[], lesson: any): string {
    const sectionContent = lessonSections.map(section => {
      const content = section.content || section.description || '';
      return `## ${section.title}\n${content}`;
    }).join('\n\n');

    return `# ${lesson.title}\n\n${lesson.description}\n\n${sectionContent}`;
  }

  // Helper method to map academic level to difficulty
  private mapAcademicLevelToDifficulty(academicLevel?: string): 'easy' | 'medium' | 'hard' {
    if (!academicLevel) return 'medium';
    
    const level = academicLevel.toLowerCase();
    if (level.includes('kindergarten') || level.includes('1st') || level.includes('2nd') || level.includes('3rd')) {
      return 'easy';
    } else if (level.includes('college') || level.includes('graduate') || level.includes('professional') || level.includes('master')) {
      return 'hard';
    } else {
      return 'medium';
    }
  }

  /**
   * Generate all content for a module in a single AI call for maximum efficiency
   */
  private async generateModuleContentBatch(
    module: CourseModule,
    request: CourseGenerationRequest,
    kbContent: any[]
  ): Promise<any> {
    console.log(`🔥 generateModuleContentBatch started for: ${module.title}`);
    try {
      const prompt = `
      Generate comprehensive educational content for an ENTIRE MODULE with multiple lessons.
      
      MODULE: ${module.title}
      Description: ${module.description}
      Total Lessons: ${module.lessons.length}
      Academic Level: ${request.academicLevel}
      Detail Level: ${request.lessonDetailLevel}
      
      LESSONS IN THIS MODULE:
      ${module.lessons.map((l, i) => `
      Lesson ${i + 1}: ${l.title}
      - Description: ${l.description}
      - Learning Objectives: ${l.learningObjectives.join(', ')}
      - Sections: ${l.contentOutline.join(', ')}
      `).join('\n')}
      
      ${this.getAcademicLevelGuidance(request.academicLevel)}
      ${this.getLessonDetailGuidance(request.lessonDetailLevel)}
      
      CRITICAL INSTRUCTIONS:
      1. Generate ACTUAL TEACHING CONTENT, not placeholders or outlines
      2. Each section should contain substantive educational material
      3. Include examples, activities, and assessments as specified
      4. Content should progressively build through the module
      5. Maintain consistency in teaching style and depth
      
      Generate a complete module structure as JSON:
      {
        "moduleTitle": "${module.title}",
        "lessons": [
          {
            "lessonTitle": "Lesson Title",
            "sections": [
              {
                "sectionTitle": "Section Title",
                "introduction": "2-3 sentence intro to this section",
                "mainContent": [
                  {
                    "heading": "Key Topic",
                    "content": "Detailed educational content that actually teaches the concept. This should be multiple paragraphs of real teaching material.",
                    "examples": ["Detailed example 1", "Detailed example 2"],
                    "keyPoints": ["Important point 1", "Important point 2"]
                  }
                ],
                "activities": [
                  {
                    "type": "practice",
                    "instruction": "Clear activity instructions",
                    "duration": "10 minutes"
                  }
                ],
                "keyTakeaways": ["Main learning 1", "Main learning 2"]
              }
            ],
            "assessmentQuestions": [
              {
                "questionText": "Question about the lesson content?",
                "questionType": "multiple_choice",
                "options": [
                  { "text": "Option A", "correct": false, "explanation": "Why incorrect" },
                  { "text": "Option B", "correct": true, "explanation": "Why correct" },
                  { "text": "Option C", "correct": false, "explanation": "Why incorrect" },
                  { "text": "Option D", "correct": false, "explanation": "Why incorrect" }
                ],
                "points": 10,
                "difficultyLevel": "medium"
              }
            ]
          }
        ],
        "moduleQuiz": {
          "title": "Module Quiz: ${module.title}",
          "questions": [
            {
              "questionText": "Comprehensive question covering multiple lessons?",
              "questionType": "multiple_choice",
              "options": [
                { "text": "Option A", "correct": false },
                { "text": "Option B", "correct": true },
                { "text": "Option C", "correct": false },
                { "text": "Option D", "correct": false }
              ],
              "points": 15,
              "difficultyLevel": "medium"
            }
          ]
        }
      }
      
      Remember: This is ACTUAL EDUCATIONAL CONTENT that will be used to teach students. Make it comprehensive, engaging, and appropriate for ${request.academicLevel} level learners.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are a master educator creating comprehensive educational content. Generate detailed, teaching-focused material that helps students learn and master concepts."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 16000 // Much larger for complete module content
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('Failed to generate module content');

      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error('Failed to generate module content:', error);
      throw error;
    }
  }

  /**
   * Optimized LMS entity creation with batch content generation
   */
  private async createLMSEntitiesOptimized(
    courseOutlineId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log('🚀 Creating LMS entities with optimized batch generation...');
    
    try {
      const supabase = this.getSupabaseClient();
      
      // Get all relevant KB content once
      const kbContent = await this.getRelevantKnowledgeBaseContent(
        request.baseClassId,
        request.title,
        request.description || '',
        request.generationMode || 'kb_supplemented'
      );

      // Generate content for all modules in parallel (but limit concurrency)
      console.log(`🔄 About to generate content for ${outline.modules.length} modules...`);
      const moduleContents = await this.generateAllModulesInBatches(
        outline.modules,
        request,
        kbContent
      );
      console.log(`✅ Successfully generated content for all ${outline.modules.length} modules`);

      // Step 1: Create all paths and lessons first (sequential for DB constraints)
      const createdPaths: Array<{ pathData: { id: string; title: string }, moduleIndex: number }> = [];
      const createdLessons: Array<{ lessonData: { id: string }, pathId: string, moduleIndex: number, lessonIndex: number }> = [];

      for (let moduleIndex = 0; moduleIndex < outline.modules.length; moduleIndex++) {
        const courseModule = outline.modules[moduleIndex];

        // Create path
        const { data: path, error: pathError } = await supabase
          .from('paths')
          .insert({
            organisation_id: request.organisationId,
            base_class_id: request.baseClassId,
            title: courseModule.title,
            description: courseModule.description,
            level: request.academicLevel,
            order_index: moduleIndex,
            published: false,
            created_by: request.userId,
            creator_user_id: request.userId
          })
          .select('id, title')
          .single();

        if (pathError || !path) {
          console.error('Failed to create path:', pathError);
          continue;
        }

        const typedPath = path as unknown as { id: string; title: string };
        console.log(`📁 Created path: ${typedPath.title}`);
        createdPaths.push({ pathData: typedPath, moduleIndex });

        // Create lessons for this path
        const moduleContent = moduleContents[moduleIndex];
        for (let lessonIndex = 0; lessonIndex < moduleContent.lessons.length; lessonIndex++) {
          const lessonOutline = courseModule.lessons[lessonIndex];

          const { data: createdLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              path_id: typedPath.id,
              base_class_id: request.baseClassId,
              title: lessonOutline.title,
              description: lessonOutline.description,
              level: request.academicLevel,
              order_index: lessonIndex,
              estimated_time: lessonOutline.estimatedDurationHours ? lessonOutline.estimatedDurationHours * 60 : 45,
              published: false,
              created_by: request.userId,
              creator_user_id: request.userId
            })
            .select('id')
            .single();

          if (lessonError || !createdLesson) {
            console.error('Failed to create lesson:', lessonError);
            continue;
          }

          const typedLesson = createdLesson as unknown as { id: string };
          createdLessons.push({ 
            lessonData: typedLesson, 
            pathId: typedPath.id, 
            moduleIndex, 
            lessonIndex 
          });
        }
      }

      // Step 2: Create all sections in parallel
      console.log('🔄 Creating lesson sections in parallel...');
      const sectionPromises = createdLessons.map(({ lessonData, moduleIndex, lessonIndex }) => {
        const moduleContent = moduleContents[moduleIndex];
        const lessonContent = moduleContent.lessons[lessonIndex];
        return this.createSectionsFromGeneratedContent(
          lessonData.id,
          lessonContent.sections,
          request.userId
        );
      });
      await Promise.all(sectionPromises);
      console.log('✅ All lesson sections created');

      // Step 3: Create all assessments in parallel batches
      if (request.assessmentSettings?.includeAssessments || 
          request.assessmentSettings?.includeQuizzes || 
          request.assessmentSettings?.includeFinalExam) {
        
        console.log('🎯 Creating assessments in parallel...');
        const assessmentPromises: Promise<void>[] = [];

        // Lesson assessments
        if (request.assessmentSettings?.includeAssessments) {
          const lessonAssessmentPromises = createdLessons.map(({ lessonData, moduleIndex, lessonIndex }) => {
            const courseModule = outline.modules[moduleIndex];
            const lessonOutline = courseModule.lessons[lessonIndex];
            return this.createLessonAssessmentsBatch(lessonData.id, lessonOutline, request);
          });
          assessmentPromises.push(...lessonAssessmentPromises);
        }

        // Path quizzes
        if (request.assessmentSettings?.includeQuizzes) {
          const pathQuizPromises = createdPaths.map(({ pathData }) => 
            this.createPathQuiz(pathData.id, pathData.title, request)
          );
          assessmentPromises.push(...pathQuizPromises);
        }

        // Class final exam
        if (request.assessmentSettings?.includeFinalExam) {
          assessmentPromises.push(
            this.createClassExam(request.baseClassId, request.title, request)
          );
        }

        // Execute all assessment creation in parallel
        await Promise.allSettled(assessmentPromises);
        console.log('✅ All assessments processed');
      }

      console.log('✅ Optimized LMS entity creation completed!');
    } catch (error) {
      console.error('❌ Failed to create LMS entities:', error);
      throw error;
    }
  }

  /**
   * Generate content for all modules with controlled concurrency
   */
  private async generateAllModulesInBatches(
    modules: CourseModule[],
    request: CourseGenerationRequest,
    kbContent: any[]
  ): Promise<any[]> {
    const batchSize = 2; // Process 2 modules at a time to avoid overwhelming the API
    
    console.log(`🚀 Starting PARALLEL batch generation for ${modules.length} modules...`);

    // Create all batches upfront
    const batches = [];
    for (let i = 0; i < modules.length; i += batchSize) {
      const batch = modules.slice(i, i + batchSize);
      batches.push({
        batchNumber: Math.floor(i / batchSize) + 1,
        startIndex: i + 1,
        endIndex: Math.min(i + batchSize, modules.length),
        modules: batch
      });
    }

    console.log(`🔥 Created ${batches.length} batches - ALL WILL RUN IN PARALLEL!`);

    // Process ALL batches in parallel
    const allBatchPromises = batches.map(async (batchInfo) => {
      console.log(`🔄 Processing batch ${batchInfo.batchNumber}: modules ${batchInfo.startIndex}-${batchInfo.endIndex}`);
      
      const batchPromises = batchInfo.modules.map((module) => {
        console.log(`📝 Starting generation for module: ${module.title}`);
        return this.generateModuleContentBatch(module, request, kbContent)
          .then(result => {
            console.log(`✅ Completed generation for module: ${module.title}`);
            return result;
          })
          .catch(error => {
            console.error(`❌ Failed generation for module: ${module.title}`, error);
            throw error;
          });
      });
      
      const batchResults = await Promise.all(batchPromises);
      console.log(`📊 Generated content for modules ${batchInfo.startIndex}-${batchInfo.endIndex} of ${modules.length}`);
      return batchResults;
    });

    // Wait for ALL batches to complete
    const allResults = await Promise.all(allBatchPromises);
    const flatResults = allResults.flat();

    console.log(`✅ Completed all ${modules.length} modules batch generation`);
    return flatResults;
  }

  /**
   * Helper to create sections from pre-generated content
   */
  private async createSectionsFromGeneratedContent(
    lessonId: string,
    sections: any[],
    userId: string
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    
    const sectionPromises = sections.map(async (section, index) => {
      try {
      let sectionType = 'main_content';
      if (index === 0) sectionType = 'introduction';
      if (index === sections.length - 1) sectionType = 'summary';
      
        // Sanitize the section content to prevent stack depth issues
        const sanitizedContent = {
          sectionTitle: section.sectionTitle || `Section ${index + 1}`,
          content: section.content || section.sectionContent || '',
          learningObjectives: section.learningObjectives || [],
          keyPoints: section.keyPoints || [],
          activities: section.activities || [],
          examples: section.examples || []
        };

        const { error } = await supabase
        .from('lesson_sections')
        .insert({
          lesson_id: lessonId,
          title: sanitizedContent.sectionTitle,
          content: sanitizedContent,
          section_type: sectionType,
          order_index: index,
          created_by: userId
        });

        if (error) {
          // Handle constraint violations gracefully
          if (error.code === '23505') { // Unique constraint violation
            console.warn(`Duplicate section detected for lesson ${lessonId}, index ${index}, skipping...`);
            return;
          }
          if (error.code === '23503') { // Foreign key constraint violation
            console.error(`Invalid reference in section creation for lesson ${lessonId}:`, error);
            throw new Error(`Database reference error: ${error.message}`);
          }
          if (error.code === '23514') { // Check constraint violation
            console.error(`Data validation failed for section in lesson ${lessonId}:`, error);
            throw new Error(`Data validation error: ${error.message}`);
          }
          
          console.error(`Failed to create section ${index} for lesson ${lessonId}:`, error);
          throw new Error(`Failed to create lesson section: ${error.message}`);
        }
      } catch (dbError: any) {
        if (dbError.code?.startsWith('23')) {
          // Database constraint error - log and continue with next section
          console.warn(`Database constraint error for section ${index}, continuing:`, dbError.message);
          return;
        }
        throw dbError;
      }
    });

    await Promise.all(sectionPromises);
  }

  /**
   * Helper to create questions from pre-generated content
   */
  private async createQuestionsFromGeneratedContent(
    lessonId: string,
    questions: any[],
    userId: string
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    
    try {
      // Create a question folder for this lesson
      const { data: folder, error: folderError } = await supabase
        .from('question_folders')
        .insert({
          name: `Lesson Questions - ${lessonId}`,
          description: `Questions for lesson ${lessonId}`,
          created_by: userId
        })
        .select()
        .single();

      if (folderError) {
        console.error('Failed to create question folder:', folderError);
        return;
      }

      const questionPromises = questions.map(async (q: any, index: number) => {
        const { data: lessonQuestion, error } = await (supabase as any)
          .from('questions')
          .insert({
            folder_id: folder.id,
            lesson_id: lessonId,
            question_text: q.questionText || q.question_text,
            question_type: q.questionType || q.question_type,
            points: q.points || 10,
            order_index: index,
            created_by: userId,
            options: q.options || null,
            answer_key: q.options ? { correct_answers: q.options.filter((opt: any) => opt.correct || opt.is_correct).map((opt: any) => opt.text || opt.option_text) } : null
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create question:', error);
          return;
        }

        console.log(`❓ Created question: ${q.questionText || q.question_text}`);
      });

      await Promise.all(questionPromises);
    } catch (error) {
      console.error('Failed to create questions from generated content:', error);
    }
  }

  /**
   * Helper to create quiz from pre-generated content  
   */
  private async createQuizFromGeneratedContent(
    pathId: string,
    quizData: any,
    userId: string
  ): Promise<void> {
    const supabase = this.getSupabaseClient();

    try {
      // Insert quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          path_id: pathId,
          title: quizData.title,
          description: quizData.description,
          assessment_type: 'quiz',
          time_limit: quizData.timeLimit || quizData.time_limit || 60,
          pass_threshold: quizData.passThreshold || quizData.pass_threshold || 70,
          shuffle_questions: true,
          max_attempts: 3,
          show_feedback: true,
          auto_grade: true,
          created_by: userId
        })
        .select()
        .single();

      if (quizError) {
        console.error('Failed to create quiz:', quizError);
        return;
      }

      // Create question folder for quiz questions
      const { data: folder, error: folderError } = await supabase
        .from('question_folders')
        .insert({
          name: `${quizData.title} - Questions`,
          description: `Questions for quiz: ${quizData.title}`,
          created_by: userId
        })
        .select()
        .single();

      if (folderError) {
        console.error('Failed to create quiz question folder:', folderError);
        return;
      }

      // Insert quiz questions with proper folder_id
      if (quizData.questions && Array.isArray(quizData.questions)) {
        for (let i = 0; i < quizData.questions.length; i++) {
          const q = quizData.questions[i];
          
          const { data: question, error: questionError } = await (supabase as any)
            .from('questions')
            .insert({
              folder_id: folder.id,
              quiz_id: quiz.id,
              question_text: q.questionText || q.question_text,
              question_type: q.questionType || q.question_type,
              points: q.points || 15,
              order_index: i,
              created_by: userId,
              options: q.options || null,
              answer_key: q.options ? { correct_answers: q.options.filter((opt: any) => opt.correct || opt.is_correct).map((opt: any) => opt.text || opt.option_text) } : null
            })
            .select()
            .single();

          if (questionError) {
            console.error('Failed to create quiz question:', questionError);
            continue;
          }
        }
      }

      console.log(`📝 Created quiz: ${quizData.title}`);
    } catch (error) {
      console.error('Failed to create quiz from generated content:', error);
    }
  }

  /**
   * Create lesson sections with comprehensive educational content
   * This replaces the old lesson content generation and creates rich, progressive educational content
   */
  private async createLessonSectionsWithComprehensiveContent(
    lessonId: string,
    lesson: ModuleLesson,
    request: CourseGenerationRequest,
    outline: CourseOutline,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented'
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const modeConfig = COURSE_GENERATION_MODES[generationMode];
    
    // Get cached KB content for this lesson
    const cacheKey = `${outline.knowledgeBaseAnalysis.baseClassId}-${generationMode}`;
    let kbContent = this.kbContentCache.get(cacheKey) || [];
    
    // Filter KB content to be relevant to this specific lesson
    const lessonKeywords = `${lesson.title} ${lesson.description} ${lesson.learningObjectives.join(' ')}`.toLowerCase();
    const relevantKbContent = kbContent.filter(chunk => {
      const chunkText = (chunk.summary || chunk.content || '').toLowerCase();
      return lesson.learningObjectives.some(objective => 
        chunkText.includes(objective.toLowerCase()) ||
        lessonKeywords.split(' ').some(keyword => keyword.length > 3 && chunkText.includes(keyword))
      );
    }).slice(0, 10);
    
    const finalKbContent = relevantKbContent.length > 0 ? relevantKbContent : kbContent.slice(0, 15);
    
    console.log(`🎓 Generating comprehensive educational content for lesson: ${lesson.title}`);
    
    const prompt = `
You are a master educator creating comprehensive lesson sections that will TEACH students, not just inform them.

LESSON CONTEXT:
- Title: ${lesson.title}
- Description: ${lesson.description}
- Learning Objectives: ${lesson.learningObjectives.join(', ')}
- Content Type: ${lesson.contentType}
- Duration: ${lesson.estimatedDurationHours} hours
- Sections to Create: ${lesson.contentOutline.join(', ')}

COURSE CONTEXT:
- Academic Level: ${request.academicLevel || 'college'}
- Content Depth: ${request.lessonDetailLevel || 'detailed'}
- Target Audience: ${request.targetAudience || 'General learners'}
- Prerequisites: ${request.prerequisites || 'None specified'}

${this.getAcademicLevelGuidance(request.academicLevel)}
${this.getLessonDetailGuidance(request.lessonDetailLevel)}

GENERATION MODE: ${modeConfig.title}
${modeConfig.aiInstructions}

KNOWLEDGE BASE CONTENT:
${finalKbContent.map(chunk => `- ${chunk.summary || chunk.content.substring(0, 500)}`).join('\n')}

CRITICAL EDUCATIONAL PRINCIPLES:
1. **Progressive Learning**: Each section builds upon previous knowledge
2. **Active Teaching**: Content actively teaches, doesn't just present information
3. **Mastery Focus**: Use "I do, We do, You do" gradual release model
4. **Clear Connections**: Explicitly connect all content to learning objectives
5. **Multiple Examples**: Include varied examples, demonstrations, and practice
6. **Misconception Prevention**: Address common student misunderstandings
7. **Real-World Relevance**: Use analogies, stories, and practical connections
8. **Comprehension Checks**: Include understanding verification throughout
9. **Engaging Delivery**: Make content memorable and interesting
10. **Differentiated Support**: Provide scaffolding and extension opportunities

Generate comprehensive educational content for ALL lesson sections as a JSON array:
[
  {
    "title": "Section Title (from contentOutline)",
    "section_type": "introduction|main_content|activity|summary",
    "educational_content": {
      "introduction": "Engaging section introduction that connects to prior knowledge and previews what students will learn (2-3 paragraphs)",
      "main_teaching_content": [
        {
          "concept_title": "Key Concept Name",
          "explanation": "Comprehensive explanation that teaches the concept step-by-step. This should be multiple detailed paragraphs of actual teaching content that guides student understanding progressively.",
          "examples": [
            {
              "type": "worked_example|real_world|analogy|case_study",
              "title": "Example Title",
              "content": "Detailed example with step-by-step explanation that illuminates the concept"
            }
          ],
          "guided_practice": {
            "activity": "Specific practice activity students can do with guidance",
            "instructions": "Clear step-by-step instructions",
            "expected_outcome": "What students should be able to demonstrate"
          }
        }
      ],
      "key_concepts": ["Essential concepts students must master from this section"],
      "common_misconceptions": [
        {
          "misconception": "What students often get wrong",
          "explanation": "Why this misconception occurs",
          "correction": "How to address and correct it"
        }
      ],
      "comprehension_checks": [
        {
          "type": "question|activity|reflection",
          "prompt": "Specific way to check understanding",
          "purpose": "What this check reveals about student learning"
        }
      ],
      "independent_practice": {
        "activity": "What students can do on their own to practice",
        "scaffolding": "Support for students who need help",
        "extension": "Challenge for advanced students"
      },
      "section_summary": "Clear summary that reinforces key learning and connects to lesson objectives (1-2 paragraphs)"
    },
    "assessment_integration": {
      "formative_opportunities": ["Ways to assess understanding during this section"],
      "key_questions": ["Essential questions that could be used for assessment"]
    },
    "resources_needed": ["Materials, tools, or technologies required for this section"],
    "estimated_time": "Realistic time estimate for this section"
  }
]

QUALITY REQUIREMENTS:
- Each section must contain substantial, detailed educational content
- Content should be appropriate for ${request.academicLevel} level with ${request.lessonDetailLevel} depth
- All content must directly support the learning objectives
- Include specific examples, not generic placeholders
- Ensure logical flow and progression between concepts
- Make content engaging and accessible to the target audience

Generate the complete educational content now:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a master educator creating comprehensive lesson sections. ${modeConfig.aiInstructions} 
            
            Create detailed educational content for ${request.academicLevel || 'college'} level learners with ${request.lessonDetailLevel || 'detailed'} depth. 
            Your content should actively teach and guide student learning progressively.
            Target audience: ${request.targetAudience || 'General learners'}.
            Prerequisites: ${request.prerequisites || 'None specified'}.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 16000
      });

      const content = completion.choices[0]?.message?.content || '{}';
      let sectionsData: any[];
      
      try {
        const parsedContent = JSON.parse(content);
        sectionsData = Array.isArray(parsedContent) ? parsedContent : parsedContent.sections || [];
      } catch (parseError) {
        console.error(`Failed to parse AI response for lesson ${lesson.title}:`, parseError);
        // Create fallback sections based on contentOutline
        sectionsData = lesson.contentOutline.map((title, index) => ({
          title,
          section_type: index === 0 ? 'introduction' : 
                       index === lesson.contentOutline.length - 1 ? 'summary' : 'main_content',
          educational_content: {
            introduction: `This section covers ${title} as part of ${lesson.title}.`,
            main_teaching_content: [{
              concept_title: title,
              explanation: `Comprehensive content for ${title} will be developed based on the lesson objectives: ${lesson.learningObjectives.join(', ')}.`,
              examples: [{ type: "practical", title: "Example", content: "Practical example will be provided." }]
            }],
            key_concepts: [title],
            section_summary: `This section covered the key concepts of ${title}.`
          },
          estimated_time: `${Math.ceil(lesson.estimatedDurationHours / lesson.contentOutline.length * 60)} minutes`
        }));
      }

      // Update existing sections or create new ones with comprehensive content
      const sectionPromises = sectionsData.map(async (sectionData, index) => {
        try {
          // First, try to update existing section
          const { data: existingSections, error: fetchError } = await supabase
            .from('lesson_sections')
            .select('id')
            .eq('lesson_id', lessonId)
            .eq('order_index', index);

          if (fetchError) {
            console.error('Error fetching existing sections:', fetchError);
            return;
          }

          const sectionTitle = sectionData.title || lesson.contentOutline[index] || `Section ${index + 1}`;
          const sectionContent = sectionData.educational_content || sectionData;
          const sectionType = sectionData.section_type || (
            index === 0 ? 'introduction' : 
            index === sectionsData.length - 1 ? 'summary' : 
            'main_content'
          );

          if (existingSections && existingSections.length > 0) {
            // Update existing section with comprehensive content
            const { error: updateError } = await supabase
              .from('lesson_sections')
              .update({
                title: sectionTitle,
                content: sectionContent,
                section_type: sectionType
              })
              .eq('id', existingSections[0].id);

            if (updateError) {
              console.error(`Failed to update section ${index} for lesson ${lessonId}:`, updateError);
            } else {
              console.log(`✅ Updated section: ${sectionTitle}`);
            }
          } else {
            // Create new section if it doesn't exist
            const { data: section, error: sectionError } = await supabase
              .from('lesson_sections')
              .insert({
                lesson_id: lessonId,
                title: sectionTitle,
                content: sectionContent,
                section_type: sectionType,
                order_index: index,
                created_by: request.userId
              })
              .select()
              .single();

            if (sectionError) {
              console.error(`Failed to create section ${sectionTitle}:`, sectionError);
              throw sectionError;
            } else {
              console.log(`📖 Created comprehensive section: ${sectionTitle}`);
            }
          }
        } catch (error: any) {
          console.error(`Database error creating section ${index}:`, error);
          // Try to create with minimal content as fallback
          const { data: fallbackSection, error: fallbackError } = await supabase
            .from('lesson_sections')
            .insert({
              lesson_id: lessonId,
              title: lesson.contentOutline[index] || `Section ${index + 1}`,
              content: { 
                text: `Educational content for ${lesson.contentOutline[index] || 'this section'} - to be enhanced.`,
                fallback: true 
              },
              section_type: index === 0 ? 'introduction' : 
                           index === sectionsData.length - 1 ? 'summary' : 'main_content',
              order_index: index,
              created_by: request.userId
            })
            .select()
            .single();

          if (fallbackError) {
            console.error(`Failed to create fallback section:`, fallbackError);
            throw fallbackError;
          }

          return fallbackSection;
        }
      });

      await Promise.all(sectionPromises);
      console.log(`✅ Created ${sectionsData.length} comprehensive educational sections for: ${lesson.title}`);

    } catch (error: any) {
      console.error(`Failed to generate comprehensive content for lesson ${lesson.title}:`, error);
      throw new Error(`Failed to create lesson sections: ${error.message}`);
    }
  }

  /**
   * Create lesson assessments based on the actual lesson section content
   * This replaces KB-based question generation with content-based generation
   */
  private async createLessonAssessmentsFromSectionContent(
    lessonId: string,
    lesson: ModuleLesson,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeAssessments) return;

    const supabase = this.getSupabaseClient();

    try {
      console.log(`📝 Creating assessments from lesson section content for: ${lesson.title}`);

      // First, get the actual lesson sections that were just created
      const { data: lessonSections, error: sectionsError } = await supabase
        .from('lesson_sections')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('order_index');

      if (sectionsError || !lessonSections || lessonSections.length === 0) {
        console.log('No lesson sections found for assessment generation');
        return;
      }

      // Create a question folder for this lesson
      const { data: folder, error: folderError } = await supabase
        .from('question_folders')
        .insert({
          name: `${lesson.title} - Questions`,
          description: `Assessment questions for lesson: ${lesson.title}`,
          base_class_id: request.baseClassId,
          created_by: request.userId
        })
        .select()
        .single();

      if (folderError) {
        console.error('Failed to create question folder:', folderError);
        return;
      }

      // Generate questions based on actual lesson section content
      const questionsPerLesson = request.assessmentSettings?.questionsPerLesson || 5;
      const questions = await this.generateQuestionsFromActualSectionContent(
        lessonSections,
        lesson,
        questionsPerLesson,
        request
      );

      if (questions.length === 0) {
        console.log('No questions generated from section content');
        return;
      }

      // Insert questions into database
      const questionPromises = questions.map(async (question: any) => {
        const { data: createdQuestion, error: questionError } = await supabase
          .from('questions')
          .insert({
            base_class_id: request.baseClassId,
            lesson_id: lessonId,
            legacy_question_text: question.questionText,
            question_text: question.questionText,
            question_type: question.questionType,
            options: question.options,
            correct_answer: question.correctAnswer,
            answer_key: question.options ? { correct: question.correctAnswer, explanation: question.explanation } : null,
            points: question.points || 1,
            difficulty_score: this.mapDifficultyToScore(question.difficultyLevel || 'medium'),
            cognitive_level: question.bloomTaxonomy || 'understand',
            ai_generated: true,
            source_content: `Generated from lesson sections for: ${lesson.title}`,
            created_by: request.userId,
            estimated_time: 2,
            validation_status: 'draft',
            tags: [lesson.title.toLowerCase().replace(/\s+/g, '-')],
            learning_objectives: lesson.learningObjectives || [lesson.title]
          })
          .select()
          .single();

        if (questionError) {
          console.error('Failed to create question:', questionError);
          return null;
        }

        return createdQuestion;
      });

      const createdQuestions = await Promise.all(questionPromises);
      const successfulQuestions = createdQuestions.filter(q => q !== null);

      console.log(`✅ Created ${successfulQuestions.length} assessment questions from lesson section content for: ${lesson.title}`);

    } catch (error: any) {
      console.error(`Failed to create assessments from section content for lesson ${lesson.title}:`, error);
      throw new Error(`Failed to create lesson assessments: ${error.message}`);
    }
  }

  /**
   * Generate questions based on actual lesson section content (not KB search)
   */
  private async generateQuestionsFromActualSectionContent(
    lessonSections: any[],
    lesson: ModuleLesson,
    questionsPerLesson: number,
    request: CourseGenerationRequest
  ): Promise<any[]> {
    try {
      // Extract the actual educational content from lesson sections
      const sectionContent = lessonSections.map(section => ({
        title: section.title,
        content: section.content,
        order: section.order_index,
        type: section.section_type
      }));

      // Build comprehensive content summary from sections
      let contentSummary = `Lesson: ${lesson.title}\n`;
      contentSummary += `Description: ${lesson.description}\n`;
      contentSummary += `Learning Objectives: ${lesson.learningObjectives.join(', ')}\n\n`;
      
      contentSummary += 'LESSON SECTION CONTENT:\n';
      sectionContent.forEach(section => {
        contentSummary += `\nSection: ${section.title}\n`;
        
        if (section.content && typeof section.content === 'object') {
          // Extract educational content from the structured format
          if (section.content.educational_content) {
            const eduContent = section.content.educational_content;
            
            if (eduContent.introduction) {
              contentSummary += `Introduction: ${eduContent.introduction}\n`;
            }
            
            if (eduContent.main_teaching_content && Array.isArray(eduContent.main_teaching_content)) {
              eduContent.main_teaching_content.forEach((concept: any) => {
                contentSummary += `Concept: ${concept.concept_title || 'Key Concept'}\n`;
                contentSummary += `Explanation: ${concept.explanation || ''}\n`;
                
                if (concept.examples && Array.isArray(concept.examples)) {
                  concept.examples.forEach((example: any) => {
                    contentSummary += `Example: ${example.content || example.description || ''}\n`;
                  });
                }
              });
            }
            
            if (eduContent.key_concepts && Array.isArray(eduContent.key_concepts)) {
              contentSummary += `Key Concepts: ${eduContent.key_concepts.join(', ')}\n`;
            }
            
            if (eduContent.section_summary) {
              contentSummary += `Summary: ${eduContent.section_summary}\n`;
            }
          } else {
            // Fallback for other content formats
            contentSummary += `Content: ${JSON.stringify(section.content).substring(0, 1000)}\n`;
          }
        } else if (typeof section.content === 'string') {
          contentSummary += `Content: ${section.content}\n`;
        }
      });

      const prompt = `
Create ${questionsPerLesson} assessment questions based on this ACTUAL lesson content (not external knowledge):

${contentSummary}

ASSESSMENT REQUIREMENTS:
- Academic Level: ${request.academicLevel || 'college'}
- Questions must test understanding of the SPECIFIC content taught in the lesson sections above
- Focus on the learning objectives: ${lesson.learningObjectives.join(', ')}
- Use only information present in the lesson content provided
- Create a mix of question types appropriate for the academic level
- Ensure questions test different levels of understanding (recall, comprehension, application)

${this.getAcademicLevelGuidance(request.academicLevel)}

Generate questions as JSON array:
[
  {
    "questionText": "Question based on the lesson content?",
    "questionType": "multiple_choice",
    "options": [
      { "text": "Option A", "correct": false, "explanation": "Why this is incorrect based on lesson content" },
      { "text": "Option B", "correct": true, "explanation": "Why this is correct based on lesson content" },
      { "text": "Option C", "correct": false, "explanation": "Why this is incorrect based on lesson content" },
      { "text": "Option D", "correct": false, "explanation": "Why this is incorrect based on lesson content" }
    ],
    "correctAnswer": "Option B",
    "explanation": "Detailed explanation referencing specific lesson content",
    "points": 10,
    "difficultyLevel": "easy|medium|hard",
    "bloomTaxonomy": "remember|understand|apply|analyze|evaluate|create",
    "lessonObjectiveAligned": "Which learning objective this tests"
  }
]

CRITICAL: Questions must be based ONLY on the actual lesson content provided above. Do not use external knowledge or make assumptions beyond what was taught in the lesson sections.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an assessment specialist creating questions based on specific lesson content. 
            Create questions for ${request.academicLevel || 'college'} level learners.
            Base all questions on the provided lesson content only - do not use external knowledge.
            Ensure questions align with the stated learning objectives.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 8000
      });

      const content = completion.choices[0]?.message?.content || '{}';
      
      try {
        const parsedContent = JSON.parse(content);
        const questions = Array.isArray(parsedContent) ? parsedContent : parsedContent.questions || [];
        
        // Validate and clean questions
        return questions.filter((q: any) => q.questionText && q.options && q.correctAnswer);
        
      } catch (parseError) {
        console.error(`Failed to parse questions for lesson ${lesson.title}:`, parseError);
        return [];
      }

    } catch (error: any) {
      console.error(`Failed to generate questions from section content for lesson ${lesson.title}:`, error);
      return [];
    }
  }

  /**
   * Map difficulty level to numerical score for database storage
   */
  private mapDifficultyToScore(difficulty: string): number {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 3;
      case 'medium': return 5;
      case 'hard': return 8;
      case 'expert': return 10;
      default: return 5;
    }
  }

  /**
   * Update the status of a generation job
   */
  private async updateJobStatus(
    jobId: string, 
    status: 'queued' | 'processing' | 'completed' | 'failed', 
    progress: number, 
    error?: string | null, 
    result?: any
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();
      const updateData: any = {
        status,
        progress_percentage: progress,
        updated_at: new Date().toISOString()
      };

      if (error !== undefined) {
        updateData.error_message = error;
      }

      if (result !== undefined) {
        updateData.result_data = result;
      }

      const { error: updateError } = await supabase
        .from('course_generation_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (updateError) {
        console.error('Failed to update job status:', updateError);
        throw new Error(`Failed to update job status: ${updateError.message}`);
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  /**
   * Get the current status of a generation job
   */
  async getGenerationJob(jobId: string): Promise<GenerationJob | null> {
    try {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase
        .from('course_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        status: data.status,
        progress: data.progress_percentage || 0,
        result: data.result_data,
        error: data.error_message
      };
    } catch (error) {
      console.error('Error getting generation job:', error);
      return null;
    }
  }

  /**
   * Get a course outline by ID
   */
  async getCourseOutline(courseOutlineId: string): Promise<CourseOutline | null> {
    try {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase
        .from('course_outlines')
        .select(`
          *,
          base_classes:base_class_id (
            title,
            description
          )
        `)
        .eq('id', courseOutlineId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        generationMode: data.generation_mode,
        learningObjectives: data.learning_objectives || [],
        estimatedDurationWeeks: data.estimated_duration_weeks || 0,
        modules: data.modules || [],
        knowledgeBaseAnalysis: data.knowledge_base_analysis || {},
        status: data.status || 'draft',
        academicLevel: data.academic_level,
        lessonDetailLevel: data.lesson_detail_level,
        targetAudience: data.target_audience,
        prerequisites: data.prerequisites,
        lessonsPerWeek: data.lessons_per_week,
        assessmentSettings: data.assessment_settings
      };
    } catch (error) {
      console.error('Error getting course outline:', error);
      return null;
    }
  }

  /**
   * Get academic level guidance for prompt generation
   */
  private getAcademicLevelGuidance(academicLevel?: string): string {
    switch (academicLevel) {
      case 'kindergarten':
      case '1st-grade':
      case '2nd-grade':
      case '3rd-grade':
        return `
ELEMENTARY GUIDANCE:
- Use very simple language and short sentences
- Focus on concrete concepts rather than abstract ideas
- Include visual and hands-on learning activities
- Questions should be basic recall and simple comprehension
- Use familiar examples from daily life
- Keep lessons short and engaging`;

      case '4th-grade':
      case '5th-grade':
      case '6th-grade':
        return `
UPPER ELEMENTARY GUIDANCE:
- Use clear, age-appropriate language
- Introduce some abstract concepts with concrete examples
- Include interactive activities and group work
- Mix recall, comprehension, and basic application questions
- Use relatable examples and scenarios
- Balance individual and collaborative learning`;

      case '7th-grade':
      case '8th-grade':
        return `
MIDDLE SCHOOL GUIDANCE:
- Use grade-appropriate vocabulary with explanations
- Develop critical thinking skills
- Include project-based learning opportunities
- Focus on comprehension, application, and analysis questions
- Connect to real-world applications
- Encourage independent thinking and research`;

      case '9th-grade':
      case '10th-grade':
      case '11th-grade':
      case '12th-grade':
        return `
HIGH SCHOOL GUIDANCE:
- Use academic vocabulary and complex concepts
- Develop analytical and critical thinking skills
- Include research and presentation components
- Focus on analysis, synthesis, and evaluation questions
- Connect to career and college preparation
- Encourage independent learning and problem-solving`;

      case 'college':
        return `
COLLEGE GUIDANCE:
- Use advanced academic vocabulary and concepts
- Develop research and analytical skills
- Include independent study and original research
- Focus on higher-order thinking: analysis, synthesis, evaluation, creation
- Connect to professional applications and current research
- Encourage critical thinking and scholarly discourse`;

      case 'graduate':
      case 'professional':
      case 'master':
        return `
GRADUATE/PROFESSIONAL GUIDANCE:
- Use professional and scholarly language
- Focus on advanced research and theoretical concepts
- Include original research and professional applications
- Emphasize critical analysis, evaluation, and innovation
- Connect to current industry practices and cutting-edge research
- Encourage leadership and expert-level problem-solving`;

      default:
        return `
GENERAL GUIDANCE:
- Use clear, appropriate language for the intended audience
- Balance theoretical concepts with practical applications
- Include varied learning activities and assessments
- Focus on comprehension, application, and analysis
- Connect to real-world examples and use cases
- Encourage active learning and engagement`;
    }
  }

  /**
   * Get lesson detail level guidance for prompt generation
   */
  private getLessonDetailGuidance(lessonDetailLevel?: string): string {
    switch (lessonDetailLevel) {
      case 'basic':
        return `
 BASIC LESSON DETAIL GUIDANCE:
 - Focus on core concepts and essential information
 - Keep explanations concise and straightforward
 - Provide clear, actionable learning objectives
 - Include simple examples and basic exercises
 - Emphasize practical application over theory
 - Limit lesson length to maintain engagement`;

      case 'comprehensive':
        return `
 COMPREHENSIVE LESSON DETAIL GUIDANCE:
 - Provide in-depth exploration of concepts
 - Include detailed explanations and multiple examples
 - Cover theoretical foundations and practical applications
 - Add extended activities and complex assessments
 - Include supplementary resources and further reading
 - Accommodate different learning styles and paces`;

      case 'detailed':
      default:
        return `
 DETAILED LESSON DETAIL GUIDANCE:
 - Balance depth with accessibility
 - Provide clear explanations with relevant examples
 - Include mix of theoretical and practical content
 - Add interactive elements and varied activities
 - Provide adequate context and background information
 - Structure content for progressive skill building`;
    }
  }
}

export const courseGenerator = new CourseGenerator(); 