import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, KnowledgeBaseAnalysis, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { knowledgeExtractor, ConceptMap, CourseStructureSuggestion } from './knowledge-extractor';
import type { Database } from '@learnologyai/types';
import { AssessmentGenerationService } from './assessment-generation-service'; // Import the new service
import { AssessmentConfig } from '@/types/lesson';

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
  private assessmentGenerator: AssessmentGenerationService; // Instantiate the new service
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
    await this.createLMSEntities(courseOutlineId, outline, request);
    await this.updateJobStatus(jobId, 'processing', 70);

    // Step 6: Generate lesson content (85% progress)
    await this.generateLessonContent(courseOutlineId, outline, generationMode, request);
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
      await this.createLMSEntities(outlineId, outline, request);

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
          content: `You are a master educator creating lesson content. ${modeConfig.aiInstructions} 
          
          Create comprehensive educational content for ${outline.academicLevel || 'college'} level learners with ${outline.lessonDetailLevel || 'detailed'} depth. 
          Your content should actively teach, not just inform.
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
      max_tokens: 10000
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

  private async generateAssessments(
    courseOutlineId: string, 
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    // Generate assessments that prioritize course content over knowledge base
    for (const courseModule of outline.modules) {
      for (const assessment of courseModule.assessments) {
        const assessmentContent = await this.generateAssessmentContent(assessment, courseModule);

        const supabase = this.getSupabaseClient();
        const { error } = await (supabase as any)
          .from('generated_lesson_content')
          .insert({
            course_outline_id: courseOutlineId,
            organisation_id: request.organisationId,
            content_type: 'assessment',
            generated_content: assessmentContent,
            generation_metadata: {
              model: 'gpt-4.1-mini',
              assessment_type: assessment.type,
              mastery_threshold: assessment.masteryThreshold,
              content_focus: assessment.contentFocus,
              timestamp: new Date().toISOString()
            },
            status: 'draft',
            user_id: request.userId
          });

        if (error) {
          console.error(`Failed to save assessment content for ${assessment.title}:`, error);
          throw new Error(`Failed to save assessment content: ${error.message}`);
        }
      }
    }
  }

  private async generateAssessmentContent(assessment: ModuleAssessment, module: CourseModule): Promise<any> {
    // This method is now deprecated and its logic is handled by AssessmentGenerationService
    return {};
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

    const supabase = this.getSupabaseClient();
    const { error: updateError } = await (supabase as any)
      .from('course_generation_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }

  async getGenerationJob(jobId: string): Promise<GenerationJob | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await (supabase as any)
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
    const supabase = this.getSupabaseClient();
    const { data, error } = await (supabase as any)
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
      status: data.status,
      academicLevel: data.academic_level,
      lessonDetailLevel: data.lesson_detail_level,
      targetAudience: data.target_audience,
      prerequisites: data.prerequisites,
      lessonsPerWeek: data.lessons_per_week,
      assessmentSettings: data.assessment_settings
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

  private getAcademicLevelGuidance(academicLevel?: string): string {
    switch (academicLevel) {
      case 'kindergarten':
        return `
EDUCATIONAL APPROACH FOR KINDERGARTEN:
- Use very simple language with short sentences
- Focus on basic concepts through play and exploration
- Heavy use of visuals, songs, and hands-on activities
- Introduce one concept at a time with lots of repetition
- 5-10 minute attention span activities
- Use stories and characters to teach concepts
- Focus on social skills alongside academic content
- Lots of positive reinforcement and encouragement`;

      case '1st-grade':
        return `
EDUCATIONAL APPROACH FOR 1ST GRADE:
- Simple vocabulary with phonics support
- Begin connecting ideas with basic logic
- Use manipulatives and visual aids extensively
- 10-15 minute focused activities
- Introduce basic reading and math concepts
- Lots of guided practice with gradual independence
- Use games and interactive activities
- Connect learning to their immediate world`;

      case '2nd-grade':
        return `
EDUCATIONAL APPROACH FOR 2ND GRADE:
- Expanding vocabulary with context clues
- Building on foundational reading and math skills
- More complex instructions with 2-3 steps
- 15-20 minute focused activities
- Introduce simple problem-solving
- Begin abstract thinking with concrete supports
- Use collaborative learning activities
- Connect to broader community concepts`;

      case '3rd-grade':
        return `
EDUCATIONAL APPROACH FOR 3RD GRADE:
- Transition to more academic language
- Multi-step problems and instructions
- 20-25 minute focused activities
- Introduce research and investigation skills
- More independent work with teacher support
- Begin comparing and contrasting concepts
- Use graphic organizers and note-taking
- Real-world applications become important`;

      case '4th-grade':
        return `
EDUCATIONAL APPROACH FOR 4TH GRADE:
- Academic vocabulary with subject-specific terms
- Complex multi-step problems
- 25-30 minute focused activities
- Develop critical thinking skills
- More abstract concepts with less concrete support
- Begin analyzing cause and effect
- Introduce basic essay writing
- Connect to state/national contexts`;

      case '5th-grade':
        return `
EDUCATIONAL APPROACH FOR 5TH GRADE:
- Sophisticated vocabulary and concepts
- Abstract thinking with minimal concrete support
- 30-35 minute focused activities
- Independent research projects
- Complex problem-solving across subjects
- Analyze multiple perspectives
- Develop study skills and organization
- Prepare for middle school transition`;

      case '6th-grade':
        return `
EDUCATIONAL APPROACH FOR 6TH GRADE:
- Middle school level academic language
- Abstract and theoretical concepts
- 35-40 minute class periods
- Independent learning with guidance
- Cross-curricular connections
- Develop arguments with evidence
- Begin specialized subject knowledge
- Focus on time management skills`;

      case '7th-grade':
        return `
EDUCATIONAL APPROACH FOR 7TH GRADE:
- Advanced academic vocabulary
- Complex theoretical concepts
- Full class period engagement (40-45 min)
- Self-directed learning projects
- Analyze complex texts and data
- Form and defend opinions with research
- Deeper subject specialization
- Develop metacognitive skills`;

      case '8th-grade':
        return `
EDUCATIONAL APPROACH FOR 8TH GRADE:
- Pre-high school academic rigor
- Abstract reasoning and analysis
- Extended focus periods (45-50 min)
- Independent research and synthesis
- Complex problem-solving strategies
- Evaluate sources and arguments
- Prepare for high school level work
- Focus on academic writing skills`;

      case '9th-grade':
        return `
EDUCATIONAL APPROACH FOR 9TH GRADE:
- High school level academic language
- Introduction to discipline-specific thinking
- Full class periods with homework
- Foundation building for advanced courses
- Develop academic research skills
- Critical analysis of primary sources
- Begin college prep mindset
- Balance breadth and depth of content`;

      case '10th-grade':
        return `
EDUCATIONAL APPROACH FOR 10TH GRADE:
- Sophisticated academic discourse
- Complex theoretical frameworks
- In-depth subject exploration
- Independent inquiry projects
- Synthesize information from multiple sources
- Develop academic arguments
- Standardized test preparation
- Career exploration connections`;

      case '11th-grade':
        return `
EDUCATIONAL APPROACH FOR 11TH GRADE:
- College-level preparatory content
- Advanced analytical thinking
- Extended research projects
- AP/IB level rigor where appropriate
- Original thought and analysis
- Complex academic writing
- College application preparation
- Real-world professional connections`;

      case '12th-grade':
        return `
EDUCATIONAL APPROACH FOR 12TH GRADE:
- College-ready academic skills
- Capstone-level projects
- Independent scholarly work
- Transition to higher education
- Original research and thesis work
- Professional-level presentations
- Career and college readiness
- Adult learning responsibilities`;

      case 'college':
        return `
EDUCATIONAL APPROACH FOR COLLEGE STUDENTS:
- Present material at undergraduate level with academic rigor
- Balance theoretical foundations with practical applications
- Introduce discipline-specific terminology with clear definitions
- Develop analytical and research skills
- Include case studies and real-world applications
- Encourage independent thinking and problem-solving
- Reference current research and contemporary issues
- Build on assumed high school knowledge base
- Foster intellectual curiosity and deeper exploration
- Include opportunities for collaborative learning
- Prepare students for professional or graduate studies`;

      case 'graduate':
        return `
EDUCATIONAL APPROACH FOR GRADUATE STUDENTS:
- Engage with advanced theoretical frameworks and methodologies
- Emphasize research, analysis, and synthesis of complex ideas
- Use sophisticated academic language and field-specific terminology
- Explore nuanced perspectives and competing theories
- Include primary sources and seminal works in the field
- Develop expertise through in-depth examination of topics
- Foster original thinking and contribution to the field
- Connect to current research and emerging trends
- Encourage critical evaluation of existing knowledge
- Prepare for doctoral research or advanced professional practice
- Include interdisciplinary connections and applications`;

      case 'professional':
        return `
EDUCATIONAL APPROACH FOR WORKING PROFESSIONALS:
- Focus on practical, immediately applicable knowledge
- Emphasize best practices and industry standards
- Include real-world case studies and scenarios
- Provide tools, templates, and actionable frameworks
- Address common workplace challenges and solutions
- Balance theory with extensive practical application
- Include time-efficient learning strategies
- Reference current industry trends and innovations
- Develop skills for leadership and advanced practice
- Include networking and professional development aspects
- Focus on ROI and business impact of learning`;

      case 'master':
        return `
EDUCATIONAL APPROACH FOR MASTERY-LEVEL LEARNING:
- Explore the most advanced concepts and cutting-edge developments
- Examine expert-level nuances and sophisticated applications
- Include comprehensive historical context and evolution of ideas
- Address complex edge cases and advanced problem-solving
- Foster innovation and original contributions to the field
- Include meta-learning and teaching others
- Explore interdisciplinary synthesis at the highest level
- Challenge existing paradigms and explore future directions
- Develop thought leadership capabilities
- Include opportunities to mentor and guide others
- Focus on pushing boundaries of current knowledge`;

      default:
        return `
EDUCATIONAL APPROACH FOR GENERAL LEARNERS:
- Provide comprehensive, well-structured educational content
- Balance accessibility with appropriate depth
- Include varied learning approaches for different learning styles
- Build knowledge progressively from fundamentals to advanced topics
- Use clear explanations with relevant examples
- Foster both understanding and practical application
- Encourage active learning and engagement
- Include self-assessment opportunities
- Adapt to diverse backgrounds and learning goals`;
    }
  }

  private getLessonDetailGuidance(lessonDetailLevel?: string): string {
    switch (lessonDetailLevel) {
      case 'basic':
        return `
CONTENT DEPTH - BASIC LEVEL:
- Provide substantial educational content covering all essential concepts
- Include clear explanations of fundamental principles
- Use 3-5 concrete examples for each major concept
- Present information in digestible sections with clear headings
- Include visual representations where helpful
- Focus on "what" and "how" with practical applications
- Ensure comprehensive coverage of core learning objectives
- Provide summaries and key takeaways
- Include practice exercises for skill reinforcement
APPROXIMATE CONTENT: 2-3 pages of rich educational material per lesson section`;

      case 'comprehensive':
        return `
CONTENT DEPTH - COMPREHENSIVE LEVEL:
- Deliver extensive, encyclopedic coverage of all topics
- Provide exhaustive explanations with multiple perspectives
- Include 10+ varied examples, case studies, and applications
- Deep dive into theoretical foundations and advanced concepts
- Explore historical context, evolution, and future directions
- Address edge cases, exceptions, and nuanced scenarios
- Include expert insights, research findings, and citations
- Provide comparative analysis of different approaches
- Include advanced exercises, projects, and research opportunities
- Cover interdisciplinary connections and applications
- Add supplementary deep-dive sections for curious learners
APPROXIMATE CONTENT: 8-12 pages of dense, detailed educational material per lesson section`;

      case 'detailed':
      default:
        return `
CONTENT DEPTH - DETAILED LEVEL:
- Provide thorough, in-depth educational content
- Include comprehensive explanations with multiple examples
- Use 5-8 varied examples and real-world applications
- Balance theoretical understanding with practical application
- Include relevant case studies and scenario-based learning
- Explore important variations and common misconceptions
- Provide both guided practice and independent exercises
- Include enrichment content for advanced learners
- Address common questions and clarifications
- Include multimedia references and additional resources
APPROXIMATE CONTENT: 4-6 pages of substantial educational material per lesson section`;
    }
  }

  /**
   * NEW: Create actual LMS entities from generated course outline
   */
  private async createLMSEntities(
    courseOutlineId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log('🏗️  Creating LMS entities from course outline...');
    const generationMode = outline.generationMode || 'kb_supplemented';
    
    try {
      const supabase = this.getSupabaseClient();
      
      // Process all modules in parallel
      const modulePromises = outline.modules.map(async (module, moduleIndex) => {
        // Create path
        const { data: path, error: pathError } = await supabase
          .from('paths')
          .insert({
            organisation_id: request.organisationId,
            base_class_id: request.baseClassId,
            title: module.title,
            description: module.description,
            level: request.academicLevel,
            order_index: moduleIndex,
            published: false, // Draft initially
            created_by: request.userId,
            creator_user_id: request.userId
          })
          .select()
          .single();

        if (pathError) {
          console.error('Failed to create path:', pathError);
          return;
        }

        console.log(`📁 Created path: ${path.title}`);

        // Process all lessons for this path in parallel
        const lessonPromises = module.lessons.map(async (lesson, lessonIndex) => {
          const { data: createdLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              path_id: path.id,
              base_class_id: request.baseClassId,
              title: lesson.title,
              description: lesson.description,
              level: request.academicLevel,
              order_index: lessonIndex,
              estimated_time: lesson.estimatedDurationHours ? lesson.estimatedDurationHours * 60 : 45, // Convert to minutes
              published: false,
              created_by: request.userId,
              creator_user_id: request.userId
            })
            .select()
            .single();

          if (lessonError) {
            console.error('Failed to create lesson:', lessonError);
            return;
          }

          console.log(`📖 Created lesson: ${createdLesson.title}`);

          // Create comprehensive lesson sections with educational content
          await this.createLessonSectionsWithComprehensiveContent(
            createdLesson.id, 
            lesson, 
            request, 
            outline,
            generationMode
          );

          // Then create assessments based on the actual lesson section content
          if (request.assessmentSettings?.includeAssessments) {
            await this.createLessonAssessmentsFromSectionContent(createdLesson.id, lesson, request);
          }
        });

        // Wait for all lessons to be created
        await Promise.all(lessonPromises);

        // Create path quiz if enabled
        if (request.assessmentSettings?.includeQuizzes) {
          await this.createPathQuiz(path.id, module, request);
        }
      });

      // Wait for all modules to be processed
      await Promise.all(modulePromises);

      // Create class exam if enabled
      if (request.assessmentSettings?.includeFinalExam) {
        await this.createClassExam(outline, request);
      }

      console.log('✅ LMS entities created successfully!');
    } catch (error) {
      console.error('❌ Failed to create LMS entities:', error);
      throw error;
    }
  }

  /**
   * Create lesson sections in batch for better performance
   */
  private async createLessonSectionsBatch(
    lessonId: string,
    lesson: any,
    request: CourseGenerationRequest
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const contentOutline = lesson.contentOutline || [];

    if (contentOutline.length === 0) return;

    // Generate all section content in a single AI call
    const allSectionContent = await this.generateAllSectionsContent(
      lesson,
      contentOutline,
      request
    );

    // Create all sections in parallel
    const sectionPromises = contentOutline.map(async (sectionTitle: string, i: number) => {
      const sectionType = i === 0 ? 'introduction' : 
                         i === contentOutline.length - 1 ? 'summary' : 
                         'main_content';
      
      const sectionContent = allSectionContent[i] || {
        introduction: `Introduction to ${sectionTitle}`,
        main_content: [{ 
          heading: sectionTitle, 
          content: "Content to be added." 
        }],
        key_takeaways: ["Key concepts from this section"]
      };

      const { data: section, error: sectionError } = await supabase
        .from('lesson_sections')
        .insert({
          lesson_id: lessonId,
          title: sectionTitle,
          content: sectionContent,
          section_type: sectionType,
          order_index: i,
          created_by: request.userId
        })
        .select()
        .single();

      if (sectionError) {
        console.error('Failed to create lesson section:', sectionError);
      } else {
        console.log(`📄 Created section: ${section.title}`);
      }
    });

    await Promise.all(sectionPromises);
  }

  /**
   * Generate content for all sections in a single AI call
   */
  private async generateAllSectionsContent(
    lesson: any,
    contentOutline: string[],
    request: CourseGenerationRequest
  ): Promise<any[]> {
    try {
      const prompt = `
      Generate comprehensive educational content for ALL sections of this lesson:
      
      Lesson: ${lesson.title}
      Description: ${lesson.description}
      Academic Level: ${request.academicLevel}
      Detail Level: ${request.lessonDetailLevel}
      
      Sections to create content for:
      ${contentOutline.map((title, i) => `${i + 1}. ${title}`).join('\n')}
      
      ${this.getAcademicLevelGuidance(request.academicLevel)}
      ${this.getLessonDetailGuidance(request.lessonDetailLevel)}
      
      Create structured content as JSON array with one object per section:
      [
        {
          "sectionTitle": "Section 1 Title",
          "introduction": "Brief section introduction (2-3 sentences)",
          "main_content": [
            {
              "heading": "Key Concept or Topic",
              "content": "Detailed explanation with examples - this should be ACTUAL TEACHING CONTENT, not placeholders",
              "examples": ["Practical example 1 with details", "Practical example 2 with details"],
              "key_points": ["Important point 1", "Important point 2"]
            }
          ],
          "activities": [
            {
              "type": "reflection",
              "instruction": "Think about how this applies to...",
              "duration": "5 minutes"
            }
          ],
          "key_takeaways": ["Main takeaway 1", "Main takeaway 2"],
          "additional_resources": ["Resource 1", "Resource 2"]
        }
      ]
      
      CRITICAL: Create ACTUAL EDUCATIONAL CONTENT that teaches, not placeholders. Each section should have substantial teaching material appropriate for ${request.academicLevel} level with ${request.lessonDetailLevel} depth.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 16000 // Increased for multiple sections with full content
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return contentOutline.map(() => ({ error: 'Failed to generate content' }));

      // Parse JSON with proper error handling
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || [null, content];
        const sections = JSON.parse(jsonMatch[1]);
        
        // Map sections by title to ensure correct order
        return contentOutline.map(title => {
          const section = sections.find((s: any) => 
            s.sectionTitle?.toLowerCase().includes(title.toLowerCase()) ||
            title.toLowerCase().includes(s.sectionTitle?.toLowerCase())
          );
          return section || {
            introduction: `Introduction to ${title}`,
            main_content: [{ heading: title, content: "Content to be added." }],
            key_takeaways: ["Key concepts"]
          };
        });
      } catch (parseError) {
        console.error('Failed to parse sections JSON:', parseError);
        console.log('Raw content:', content);
        // Return fallback content for each section
        return contentOutline.map(title => ({
          introduction: `Introduction to ${title}`,
          main_content: [{ heading: title, content: "Content to be added." }],
          key_takeaways: ["Key concepts"]
        }));
      }
    } catch (error) {
      console.error('Failed to generate section content:', error);
      return contentOutline.map(title => ({
        introduction: `Introduction to ${title}`,
        main_content: [{ heading: title, content: "Content to be added." }],
        key_takeaways: ["Key concepts"]
      }));
    }
  }

  /**
   * Create lesson assessments in batch
   */
  private async createLessonAssessmentsBatch(
    lessonId: string,
    lesson: any,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeAssessments) return;

    const supabase = this.getSupabaseClient();

    try {
      // First, get the actual lesson content that was created
      const { data: lessonSections, error: sectionsError } = await supabase
        .from('lesson_sections')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('order_index');

      if (sectionsError || !lessonSections || lessonSections.length === 0) {
        console.log('No lesson sections found, skipping assessment generation');
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

      // Generate questions based on actual lesson content
      const questionsPerLesson = request.assessmentSettings?.questionsPerLesson || 5;
      const questions = await this.generateQuestionsFromLessonContent(
        lessonSections,
        lesson,
        questionsPerLesson,
        request
      );

      if (questions.length === 0) return;

      // Create all questions with proper folder_id
      const questionPromises = questions.map(async (q: any, i: number) => {
        const { data: lessonQuestion, error: questionError } = await (supabase as any)
          .from('questions')
          .insert({
            folder_id: folder.id,
            lesson_id: lessonId,
            question_text: q.question_text,
            question_type: q.question_type,
            points: q.points || 10,
            learning_objectives: q.learning_objectives || [],
            order_index: i,
            created_by: request.userId,
            options: q.options || null,
            answer_key: q.options ? { correct_answers: q.options.filter((opt: any) => opt.is_correct).map((opt: any) => opt.option_text) } : null
          })
          .select()
          .single();

        if (questionError) {
          console.error('Failed to create lesson question:', questionError);
          return;
        }

        console.log(`❓ Created lesson question: ${q.question_text.substring(0, 50)}...`);
      });

      await Promise.all(questionPromises);
    } catch (error) {
      console.error('Failed to create lesson assessments:', error);
    }
  }

  /**
   * Generate questions based on actual lesson content
   */
  private async generateQuestionsFromLessonContent(
    lessonSections: any[],
    lesson: any,
    questionsPerLesson: number,
    request: CourseGenerationRequest
  ): Promise<any[]> {
    try {
      // Collect actual content from lesson sections
      const sectionContent = lessonSections.map(section => ({
        title: section.title,
        content: section.content || section.description,
        order: section.order_index
      }));

      const prompt = `
      Create ${questionsPerLesson} assessment questions based on this ACTUAL lesson content:
      
      Lesson: ${lesson.title}
      Description: ${lesson.description}
      Academic Level: ${request.academicLevel}
      
      ACTUAL LESSON CONTENT:
      ${sectionContent.map(section => `
      Section ${section.order + 1}: ${section.title}
      Content: ${section.content}
      `).join('\n')}
      
      ${this.getAcademicLevelGuidance(request.academicLevel)}
      
      Generate questions as a valid JSON array. Questions must be based on the actual content provided above:
      [
        {
          "question_text": "Question directly based on the lesson content above",
          "question_type": "multiple_choice",
          "points": 10,
          "learning_objectives": ["Specific objective tested"],
          "options": [
            { "option_text": "Option A", "is_correct": false, "explanation": "Why this is incorrect" },
            { "option_text": "Option B", "is_correct": true, "explanation": "Why this is the correct answer" },
            { "option_text": "Option C", "is_correct": false, "explanation": "Why this is incorrect" },
            { "option_text": "Option D", "is_correct": false, "explanation": "Why this is incorrect" }
          ]
        }
      ]
      
      IMPORTANT: 
      - Questions must be directly based on the actual content provided
      - Use a mix of multiple choice, true/false, and short answer questions
      - Questions should test understanding of the specific content, not general knowledge
      - Return ONLY valid JSON, no markdown formatting
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 3000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return [];

      // Better JSON parsing with error handling
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || [null, content];
        const parsedQuestions = JSON.parse(jsonMatch[1]);
        return Array.isArray(parsedQuestions) ? parsedQuestions : [];
      } catch (parseError) {
        console.error('Failed to parse question JSON:', parseError);
        console.log('Raw content:', content);
        return [];
      }
    } catch (error) {
      console.error('Failed to generate questions from lesson content:', error);
      return [];
    }
  }

  /**
   * Generate all lesson questions in a single AI call (legacy method)
   */
  private async generateLessonQuestions(
    lesson: any,
    questionsPerLesson: number,
    request: CourseGenerationRequest
  ): Promise<any[]> {
    try {
      const prompt = `
      Create ${questionsPerLesson} assessment questions for this lesson:
      
      Lesson: ${lesson.title}
      Description: ${lesson.description}
      Learning Objectives: ${lesson.learningObjectives?.join(', ') || 'General understanding'}
      Academic Level: ${request.academicLevel}
      
      ${this.getAcademicLevelGuidance(request.academicLevel)}
      
      Generate questions as JSON array:
      [
        {
          "question_text": "Clear, specific question about the lesson content appropriate for ${request.academicLevel} level?",
          "question_type": "multiple_choice",
          "points": 10,
          "difficulty_level": "medium",
          "bloom_taxonomy": "understand",
          "learning_objectives": ["Specific objective tested"],
          "options": [
            { "option_text": "Option A", "is_correct": false, "explanation": "Why this is incorrect" },
            { "option_text": "Option B", "is_correct": true, "explanation": "Why this is the correct answer" },
            { "option_text": "Option C", "is_correct": false, "explanation": "Why this is incorrect" },
            { "option_text": "Option D", "is_correct": false, "explanation": "Why this is incorrect" }
          ]
        }
      ]
      
      Include a mix of: multiple choice, true/false, and short answer questions.
      Questions should be age-appropriate and test understanding, not just memorization.
      Make questions progressively harder through the set.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 3000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return [];

      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || [null, content];
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
      console.error('Failed to generate lesson questions:', error);
      return [];
    }
  }

  /**
   * Create path-level quiz (cumulative for entire learning path)
   */
  private async createPathQuiz(
    pathId: string,
    module: any,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeQuizzes) return;

    const supabase = this.getSupabaseClient();
    const questionsPerQuiz = request.assessmentSettings?.questionsPerQuiz || 10;

    try {
      const prompt = `
      Create a comprehensive quiz for this learning path/module:
      
      Module: ${module.title}
      Description: ${module.description}
      Lessons: ${module.lessons.map((l: any) => l.title).join(', ')}
      Question Count: ${questionsPerQuiz}
      Academic Level: ${request.academicLevel}
      
      This should be a CUMULATIVE assessment covering all lessons in this path.
      
      Generate quiz structure as valid JSON (no markdown formatting):
      {
        "title": "${module.title} - Module Quiz",
        "description": "Comprehensive assessment covering all lessons in this module",
        "time_limit": 60,
        "pass_threshold": 70,
        "questions": [
          {
            "question_text": "Question covering multiple lessons?",
            "question_type": "multiple_choice",
            "points": 15,
            "options": [
              { "option_text": "Option A", "is_correct": false },
              { "option_text": "Option B", "is_correct": true },
              { "option_text": "Option C", "is_correct": false },
              { "option_text": "Option D", "is_correct": false }
            ]
          }
        ]
      }
      
      IMPORTANT: Return ONLY valid JSON, no markdown code blocks.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 4000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return;

      let quizData: any;
      try {
        // Try to parse JSON with better error handling
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
        quizData = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('Failed to parse quiz JSON:', parseError);
        console.log('Raw content:', content);
        return;
      }

      // Insert quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          path_id: pathId,
          title: quizData.title,
          description: quizData.description,
          assessment_type: 'quiz',
          time_limit: quizData.time_limit,
          pass_threshold: quizData.pass_threshold,
          shuffle_questions: true,
          max_attempts: 3,
          show_feedback: true,
          auto_grade: true,
          created_by: request.userId
        })
        .select()
        .single();

      if (quizError) {
        console.error('Failed to create path quiz:', quizError);
        return;
      }

      // Create question folder for quiz questions
      const { data: folder, error: folderError } = await supabase
        .from('question_folders')
        .insert({
          name: `${quizData.title} - Questions`,
          description: `Questions for quiz: ${quizData.title}`,
          base_class_id: request.baseClassId,
          created_by: request.userId
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
              quiz_id: quiz.id,
              question_text: q.question_text,
              question_type: q.question_type,
              points: q.points || 15,
              order_index: i,
              created_by: request.userId,
              options: q.options || null,
              answer_key: q.options ? { correct_answers: q.options.filter((opt: any) => opt.is_correct).map((opt: any) => opt.option_text) } : null
            })
            .select()
            .single();

          if (questionError) {
            console.error('Failed to create quiz question:', questionError);
            continue;
          }
        }
      }

      console.log(`📝 Created path quiz: ${quizData.title}`);
    } catch (error) {
      console.error('Failed to create path quiz:', error);
    }
  }

  /**
   * Create comprehensive final exam for entire course
   */
  private async createClassExam(
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    if (!request.assessmentSettings?.includeFinalExam) return;

    const supabase = this.getSupabaseClient();
    const questionsPerExam = request.assessmentSettings?.questionsPerExam || 25;

    try {
      const prompt = `
      Create a comprehensive final exam for this entire course:
      
      Course: ${outline.title}
      Description: ${outline.description}
      Modules: ${outline.modules.map(m => m.title).join(', ')}
      Question Count: ${questionsPerExam}
      Academic Level: ${request.academicLevel}
      
      This should be a COMPREHENSIVE final exam covering all modules and lessons.
      
      Generate exam structure as valid JSON (no markdown formatting):
      {
        "title": "Comprehensive Final Exam - ${outline.title}",
        "description": "Comprehensive final examination covering all course material",
        "time_limit": 120,
        "pass_threshold": 75,
        "questions": [
          {
            "question_text": "Comprehensive question covering multiple modules?",
            "question_type": "multiple_choice",
            "points": 20,
            "options": [
              { "option_text": "Option A", "is_correct": false },
              { "option_text": "Option B", "is_correct": true },
              { "option_text": "Option C", "is_correct": false },
              { "option_text": "Option D", "is_correct": false }
            ]
          }
        ]
      }
      
      IMPORTANT: Return ONLY valid JSON, no markdown code blocks.
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 6000
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return;

      let examData: any;
      try {
        // Try to parse JSON with better error handling
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
        examData = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('Failed to parse exam JSON:', parseError);
        console.log('Raw content:', content);
        return;
      }

      // Insert exam (final exams are not tied to specific paths/lessons)
      const { data: exam, error: examError } = await supabase
        .from('quizzes')
        .insert({
          title: examData.title,
          description: examData.description,
          assessment_type: 'final_exam',
          time_limit: examData.time_limit,
          pass_threshold: examData.pass_threshold,
          shuffle_questions: true,
          max_attempts: 1,
          show_feedback: false,
          auto_grade: true,
          created_by: request.userId
        })
        .select()
        .single();

      if (examError) {
        console.error('Failed to create class exam:', examError);
        return;
      }

      // Create question folder for exam questions
      const { data: folder, error: folderError } = await supabase
        .from('question_folders')
        .insert({
          name: `${examData.title} - Questions`,
          description: `Questions for exam: ${examData.title}`,
          base_class_id: request.baseClassId,
          created_by: request.userId
        })
        .select()
        .single();

      if (folderError) {
        console.error('Failed to create exam question folder:', folderError);
        return;
      }

      // Insert exam questions with proper folder_id
      if (examData.questions && Array.isArray(examData.questions)) {
        for (let i = 0; i < examData.questions.length; i++) {
          const q = examData.questions[i];
          
          const { data: question, error: questionError } = await (supabase as any)
            .from('questions')
            .insert({
              quiz_id: exam.id,
              question_text: q.question_text,
              question_type: q.question_type,
              points: q.points || 20,
              order_index: i,
              created_by: request.userId,
              options: q.options || null,
              answer_key: q.options ? { correct_answers: q.options.filter((opt: any) => opt.is_correct).map((opt: any) => opt.option_text) } : null
            })
            .select()
            .single();

          if (questionError) {
            console.error('Failed to create exam question:', questionError);
            continue;
          }
        }
      }

      console.log(`🎓 Created class exam: ${examData.title}`);
    } catch (error) {
      console.error('Failed to create class exam:', error);
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
      const moduleContents = await this.generateAllModulesInBatches(
        outline.modules,
        request,
        kbContent
      );

      // Now create all entities with the pre-generated content
      for (let moduleIndex = 0; moduleIndex < outline.modules.length; moduleIndex++) {
        const courseModule = outline.modules[moduleIndex];
        const moduleContent = moduleContents[moduleIndex];

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
          .select()
          .single();

        if (pathError) {
          console.error('Failed to create path:', pathError);
          continue;
        }

        console.log(`📁 Created path: ${path.title}`);

        // Process lessons with pre-generated content
        for (let lessonIndex = 0; lessonIndex < moduleContent.lessons.length; lessonIndex++) {
          const lessonContent = moduleContent.lessons[lessonIndex];
          const lessonOutline = courseModule.lessons[lessonIndex];

          const { data: createdLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              path_id: path.id,
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
            .select()
            .single();

          if (lessonError) {
            console.error('Failed to create lesson:', lessonError);
            continue;
          }

          // Create sections with pre-generated content
          await this.createSectionsFromGeneratedContent(
            createdLesson.id,
            lessonContent.sections,
            request.userId
          );

          // Create assessment questions if enabled
          if (request.assessmentSettings?.includeAssessments && lessonContent.assessmentQuestions) {
            await this.createQuestionsFromGeneratedContent(
              createdLesson.id,
              lessonContent.assessmentQuestions,
              request.userId
            );
          }
        }

        // Create module quiz if enabled
        if (request.assessmentSettings?.includeQuizzes && moduleContent.moduleQuiz) {
          await this.createQuizFromGeneratedContent(
            path.id,
            moduleContent.moduleQuiz,
            request.userId
          );
        }
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
    const results = [];

    for (let i = 0; i < modules.length; i += batchSize) {
      const batch = modules.slice(i, i + batchSize);
      const batchPromises = batch.map(module => 
        this.generateModuleContentBatch(module, request, kbContent)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`📊 Generated content for modules ${i + 1}-${Math.min(i + batchSize, modules.length)} of ${modules.length}`);
    }

    return results;
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
      
        const { error } = await supabase
        .from('lesson_sections')
        .insert({
          lesson_id: lessonId,
          title: section.sectionTitle,
          content: section,
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

      // Create database entries for each section
      const sectionPromises = sectionsData.map(async (sectionData, index) => {
        try {
          const { data: section, error: sectionError } = await supabase
            .from('lesson_sections')
            .insert({
              lesson_id: lessonId,
              title: sectionData.title || lesson.contentOutline[index] || `Section ${index + 1}`,
              content: sectionData.educational_content || sectionData,
              section_type: sectionData.section_type || (
                index === 0 ? 'introduction' : 
                index === sectionsData.length - 1 ? 'summary' : 
                'main_content'
              ),
              order_index: index,
              created_by: request.userId
            })
            .select()
            .single();

          if (sectionError) {
            console.error(`Failed to create section ${sectionData.title}:`, sectionError);
            throw sectionError;
          } else {
            console.log(`📖 Created comprehensive section: ${section.title}`);
          }

          return section;
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
}

export const courseGenerator = new CourseGenerator(); 