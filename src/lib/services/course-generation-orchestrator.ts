import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { AssessmentGenerationService } from './assessment-generation-service';
import type { CourseGenerationRequest, CourseOutline, ModuleLesson } from './course-generator';

export interface GenerationTask {
  id: string;
  type: 'lesson_section' | 'lesson_assessment' | 'path_quiz' | 'class_exam';
  status: 'pending' | 'running' | 'completed' | 'failed';
  lessonId?: string;
  pathId?: string;
  baseClassId?: string;
  sectionIndex?: number;
  sectionTitle?: string;
  dependencies: string[];
  startTime?: Date;
  completeTime?: Date;
  error?: string;
  data?: any;
}

export interface OrchestrationState {
  jobId: string;
  tasks: Map<string, GenerationTask>;
  completedTasks: Set<string>;
  runningTasks: Set<string>;
  lessons: LessonWorkflow[];
  paths: PathWorkflow[];
  classWorkflow: ClassWorkflow;
}

export interface LessonWorkflow {
  lessonId: string;
  pathId: string;
  title: string;
  moduleLesson: ModuleLesson;
  sectionTasks: string[];
  assessmentTask?: string;
  allSectionsComplete: boolean;
}

export interface PathWorkflow {
  pathId: string;
  title: string;
  lessons: string[];
  quizTask?: string;
  allLessonsComplete: boolean;
}

export interface ClassWorkflow {
  baseClassId: string;
  paths: string[];
  examTask?: string;
  allPathsComplete: boolean;
}

export class CourseGenerationOrchestrator {
  private openai: OpenAI;
  private assessmentGenerator: AssessmentGenerationService;
  private orchestrationStates: Map<string, OrchestrationState> = new Map();
  private kbContentCache: Map<string, any[]> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.assessmentGenerator = new AssessmentGenerationService();
  }

  private getSupabaseClient() {
    return createSupabaseServerClient();
  }

  /**
   * Start the orchestrated course generation with staggered lesson section creation
   */
  async startOrchestration(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    console.log('🚀 Starting orchestrated course generation...');

    // Initialize orchestration state
    const state = await this.initializeOrchestrationState(jobId, outline, request);
    this.orchestrationStates.set(jobId, state);

    // Pre-cache knowledge base content
    await this.cacheKnowledgeBaseContent(outline, request);

    // Start staggered lesson section generation
    await this.startStaggeredSectionGeneration(state, outline, request);

    console.log('✅ Orchestrated course generation started');
  }

  /**
   * Initialize the orchestration state with all tasks and dependencies
   */
  private async initializeOrchestrationState(
    jobId: string,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<OrchestrationState> {
    const supabase = this.getSupabaseClient();
    
    // Get created paths and lessons from database
    const { data: paths } = await supabase
      .from('paths')
      .select('id, title, order_index')
      .eq('base_class_id', request.baseClassId)
      .order('order_index') as { data: Array<{id: string, title: string, order_index: number}> | null };

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title, description, path_id, order_index')
      .eq('base_class_id', request.baseClassId)
      .order('order_index') as { data: Array<{id: string, title: string, description: string, path_id: string, order_index: number}> | null };

    if (!paths || !lessons) {
      throw new Error('Failed to fetch paths and lessons for orchestration');
    }

    const tasks = new Map<string, GenerationTask>();
    const lessonWorkflows: LessonWorkflow[] = [];
    const pathWorkflows: PathWorkflow[] = [];

    // Create lesson workflows and section tasks
    for (const lesson of lessons) {
      const moduleLesson = this.findLessonInOutline(outline, lesson.title);
      if (!moduleLesson) continue;

      const sectionTasks: string[] = [];
      
      // Create a task for each section in the lesson
      for (let i = 0; i < moduleLesson.contentOutline.length; i++) {
        const sectionTitle = moduleLesson.contentOutline[i];
        const taskId = `section-${lesson.id}-${i}`;
        
        tasks.set(taskId, {
          id: taskId,
          type: 'lesson_section',
          status: 'pending',
          lessonId: lesson.id,
          pathId: lesson.path_id,
          sectionIndex: i,
          sectionTitle,
          dependencies: [],
          data: { moduleLesson, sectionTitle, outline, request }
        });
        
        sectionTasks.push(taskId);
      }

      // Create lesson assessment task (depends on all sections)
      const assessmentTaskId = `assessment-${lesson.id}`;
      tasks.set(assessmentTaskId, {
        id: assessmentTaskId,
        type: 'lesson_assessment',
        status: 'pending',
        lessonId: lesson.id,
        pathId: lesson.path_id,
        dependencies: sectionTasks,
        data: { moduleLesson, outline, request }
      });

      lessonWorkflows.push({
        lessonId: lesson.id,
        pathId: lesson.path_id,
        title: lesson.title,
        moduleLesson,
        sectionTasks,
        assessmentTask: assessmentTaskId,
        allSectionsComplete: false
      });
    }

    // Create path workflows and quiz tasks
    for (const path of paths) {
      const pathLessons = lessons.filter(l => l.path_id === path.id);
      
      // Only include lesson assessments that actually exist in the database
      const { data: existingAssessments } = await supabase
        .from('assessments')
        .select('lesson_id')
        .in('lesson_id', pathLessons.map(l => l.id));
      
      const existingAssessmentLessonIds = new Set(
        (existingAssessments as any[])?.map((a: any) => a.lesson_id) || []
      );
      const lessonAssessmentTasks = pathLessons
        .filter(l => existingAssessmentLessonIds.has(l.id))
        .map(l => `assessment-${l.id}`);
      
      console.log(`🛤️ Path ${path.title}:`, {
        totalLessons: pathLessons.length,
        lessonsWithAssessments: lessonAssessmentTasks.length,
        dependencies: lessonAssessmentTasks
      });
      
      // Create path quiz task (depends only on existing lesson assessments)
      const quizTaskId = `quiz-${path.id}`;
      
      // Only create quiz task if there are lesson assessments to depend on
      if (lessonAssessmentTasks.length > 0) {
        tasks.set(quizTaskId, {
          id: quizTaskId,
          type: 'path_quiz',
          status: 'pending',
          pathId: path.id,
          dependencies: lessonAssessmentTasks,
          data: { pathTitle: path.title, request }
        });

        pathWorkflows.push({
          pathId: path.id,
          title: path.title,
          lessons: pathLessons.map(l => l.id),
          quizTask: quizTaskId,
          allLessonsComplete: false
        });
        
        console.log(`✅ Created quiz task for path: ${path.title} with ${lessonAssessmentTasks.length} dependencies`);
      } else {
        // Path has no lesson assessments, so no quiz task needed
        pathWorkflows.push({
          pathId: path.id,
          title: path.title,
          lessons: pathLessons.map(l => l.id),
          quizTask: undefined, // No quiz task for this path
          allLessonsComplete: true // Mark as complete since no assessments to wait for
        });
        
        console.log(`⚠️ No lesson assessments found for path: ${path.title}, skipping quiz task`);
      }
    }

    // Create class workflow and exam task
    const allQuizTasks = pathWorkflows
      .map(p => p.quizTask)
      .filter((task): task is string => task !== undefined);
    
    const examTaskId = `exam-${request.baseClassId}`;
    
    console.log(`🎓 Creating class exam task:`, {
      examTaskId,
      baseClassId: request.baseClassId,
      dependencies: allQuizTasks,
      totalPaths: pathWorkflows.length,
      pathsWithQuizzes: allQuizTasks.length,
      includeFinalExam: request.assessmentSettings?.includeFinalExam,
      classTitle: request.title
    });
    
    tasks.set(examTaskId, {
      id: examTaskId,
      type: 'class_exam',
      status: 'pending',
      baseClassId: request.baseClassId,
      dependencies: allQuizTasks,
      data: { classTitle: request.title, request }
    });

    const classWorkflow: ClassWorkflow = {
      baseClassId: request.baseClassId,
      paths: paths.map(p => p.id),
      examTask: examTaskId,
      allPathsComplete: false
    };

    console.log(`📊 Orchestration state initialized:`, {
      totalTasks: tasks.size,
      lessonWorkflows: lessonWorkflows.length,
      pathWorkflows: pathWorkflows.length,
      classWorkflow: {
        examTask: classWorkflow.examTask,
        pathsCount: classWorkflow.paths.length
      }
    });

    return {
      jobId,
      tasks,
      completedTasks: new Set(),
      runningTasks: new Set(),
      lessons: lessonWorkflows,
      paths: pathWorkflows,
      classWorkflow
    };
  }

  /**
   * Start staggered lesson section generation with 5-second intervals
   */
  private async startStaggeredSectionGeneration(
    state: OrchestrationState,
    outline: CourseOutline,
    request: CourseGenerationRequest
  ): Promise<void> {
    // Get all section tasks in sequential order
    const sectionTasks: GenerationTask[] = [];
    
    // Order by path, then lesson, then section index
    for (const pathWorkflow of state.paths) {
      for (const lessonId of pathWorkflow.lessons) {
        const lessonWorkflow = state.lessons.find(l => l.lessonId === lessonId);
        if (lessonWorkflow) {
          for (const sectionTaskId of lessonWorkflow.sectionTasks) {
            const task = state.tasks.get(sectionTaskId);
            if (task) {
              sectionTasks.push(task);
            }
          }
        }
      }
    }

    console.log(`🎯 Starting staggered generation of ${sectionTasks.length} lesson sections...`);

    // Start each section task with 5-second stagger
    for (let i = 0; i < sectionTasks.length; i++) {
      const task = sectionTasks[i];
      
      // Delay for staggered start (5 seconds apart)
      setTimeout(() => {
        this.executeTask(state, task);
      }, i * 5000);
    }
  }

  /**
   * Execute a specific generation task
   */
  private async executeTask(state: OrchestrationState, task: GenerationTask): Promise<void> {
    try {
      console.log(`🔄 Starting task: ${task.id} (${task.type})`);
      
      task.status = 'running';
      task.startTime = new Date();
      state.runningTasks.add(task.id);

      switch (task.type) {
        case 'lesson_section':
          await this.generateLessonSection(task);
          break;
        case 'lesson_assessment':
          await this.generateLessonAssessment(task);
          break;
        case 'path_quiz':
          await this.generatePathQuiz(task);
          break;
        case 'class_exam':
          await this.generateClassExam(task);
          break;
      }

      task.status = 'completed';
      task.completeTime = new Date();
      state.completedTasks.add(task.id);
      state.runningTasks.delete(task.id);

      console.log(`✅ Completed task: ${task.id} (${task.type})`);

      // Check for cascading triggers
      await this.checkAndTriggerDependentTasks(state, task);

    } catch (error) {
      console.error(`❌ Failed task: ${task.id} (${task.type}):`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      state.runningTasks.delete(task.id);
    }
  }

  /**
   * Generate a single lesson section with expert-level educational content
   */
  private async generateLessonSection(task: GenerationTask): Promise<void> {
    if (!task.lessonId || task.sectionIndex === undefined) {
      throw new Error('Invalid lesson section task data');
    }

    const { moduleLesson, sectionTitle, outline, request } = task.data;
    const supabase = this.getSupabaseClient();

    // Get cached KB content
    const cacheKey = `${outline.knowledgeBaseAnalysis.baseClassId}-${request.generationMode || 'kb_supplemented'}`;
    const kbContent = this.kbContentCache.get(cacheKey) || [];

    // Generate expert-level educational content
    const sectionContent = await this.generateExpertLevelSectionContent(
      moduleLesson,
      sectionTitle,
      task.sectionIndex!,
      outline,
      request,
      kbContent
    );

    // Save to database immediately
    const { error } = await supabase
      .from('lesson_sections')
      .insert({
        lesson_id: task.lessonId,
        title: sectionTitle,
        content: sectionContent,
        section_type: task.sectionIndex === 0 ? 'introduction' : 
                     task.sectionIndex === moduleLesson.contentOutline.length - 1 ? 'summary' : 
                     'main_content',
        order_index: task.sectionIndex,
        created_by: request.userId
      });

    if (error) {
      throw new Error(`Failed to save lesson section: ${error.message}`);
    }

    console.log(`📖 Saved lesson section: ${sectionTitle} for lesson ${task.lessonId}`);
  }

  /**
   * Generate expert-level educational content that teaches like a 1-on-1 tutor
   */
  private async generateExpertLevelSectionContent(
    lesson: ModuleLesson,
    sectionTitle: string,
    sectionIndex: number,
    outline: CourseOutline,
    request: CourseGenerationRequest,
    kbContent: any[]
  ): Promise<any> {
    const modeConfig = COURSE_GENERATION_MODES[request.generationMode || 'kb_supplemented'];
    
    // Filter KB content for this specific section
    const relevantKbContent = kbContent.filter(chunk => {
      const chunkText = (chunk.summary || chunk.content || '').toLowerCase();
      const sectionKeywords = sectionTitle.toLowerCase();
      return chunkText.includes(sectionKeywords) || 
             lesson.learningObjectives.some(obj => chunkText.includes(obj.toLowerCase()));
    }).slice(0, 8);

    const prompt = `
You are a MASTER EDUCATOR creating expert-level educational content that teaches like a dedicated 1-on-1 tutor.

SECTION CONTEXT:
- Lesson: ${lesson.title}
- Section: ${sectionTitle} (${sectionIndex + 1} of ${lesson.contentOutline.length})
- Learning Objectives: ${lesson.learningObjectives.join(', ')}
- Academic Level: ${request.academicLevel || 'college'}
- Content Depth: ${request.lessonDetailLevel || 'detailed'}

${this.getAcademicLevelGuidance(request.academicLevel)}

EXPERT TEACHING PRINCIPLES:
1. **Personal Connection**: Address the student directly ("You will..." "Let's explore...")
2. **Progressive Disclosure**: Build understanding step-by-step with clear logical flow
3. **Multi-Modal Teaching**: Include explanations, examples, analogies, and real-world connections
4. **Cognitive Scaffolding**: Support understanding at each step before moving forward
5. **Metacognitive Awareness**: Help students understand HOW to think about the concepts
6. **Error Prevention**: Anticipate and address common misconceptions proactively
7. **Active Engagement**: Include questions, reflections, and application opportunities
8. **Expertise Modeling**: Show how an expert thinks about and approaches the topic

KNOWLEDGE BASE CONTEXT:
${relevantKbContent.map(chunk => `- ${chunk.summary || chunk.content.substring(0, 400)}`).join('\n')}

Create comprehensive educational content as JSON:
{
  "sectionTitle": "${sectionTitle}",
  "introduction": "2-3 sentences that connect to prior learning and preview what this section will accomplish",
  "expertTeachingContent": {
    "conceptIntroduction": "Clear, engaging introduction to the core concept(s) with expert context",
    "detailedExplanation": "Comprehensive explanation that builds understanding progressively. Multiple detailed paragraphs that teach the concept thoroughly, as if you're sitting with the student explaining it personally.",
    "expertInsights": [
      "Professional insights that only an expert would know",
      "Common pitfalls and how to avoid them",
      "Connections to broader field knowledge"
    ],
    "practicalExamples": [
      {
        "title": "Example 1 Title",
        "context": "Why this example matters",
        "walkthrough": "Step-by-step explanation showing expert thinking",
        "keyTakeaways": ["What students should learn from this example"]
      }
    ],
    "realWorldConnections": [
      "How this concept applies in professional/real-world contexts",
      "Why experts care about this concept"
    ],
    "commonMisconceptions": [
      {
        "misconception": "What students often get wrong",
        "correction": "The correct understanding with clear explanation",
        "prevention": "How to avoid this misunderstanding"
      }
    ]
  },
  "checkForUnderstanding": [
    "Thought-provoking question that tests comprehension",
    "Application scenario to verify understanding"
  ],
  "expertSummary": "Synthesis that helps students see the big picture and connect to learning objectives",
  "bridgeToNext": "How this section connects to what comes next in the lesson"
}

CRITICAL: This content should feel like learning from a master teacher who is passionate about the subject and deeply cares about student understanding. Make it engaging, authoritative, and genuinely educational.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a master educator creating world-class educational content. Your goal is to teach concepts as clearly and effectively as a renowned expert in the field would in a 1-on-1 setting.
          
          Academic Level: ${request.academicLevel || 'college'}
          Content Depth: ${request.lessonDetailLevel || 'detailed'}
          Target Audience: ${request.targetAudience || 'Dedicated learners'}
          
          Focus on creating content that doesn't just inform, but truly teaches and builds mastery.`
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
    
    try {
      const parsedContent = JSON.parse(content);
      
      // Validate essential structure
      if (!parsedContent.expertTeachingContent?.detailedExplanation) {
        throw new Error('Missing essential teaching content');
      }
      
      return this.sanitizeContentForDatabase(parsedContent);
    } catch (parseError) {
      console.error(`Failed to parse section content for ${sectionTitle}:`, parseError);
      
      // Return comprehensive fallback
      return this.createExpertFallbackContent(lesson, sectionTitle, sectionIndex, request);
    }
  }

  /**
   * Create expert-level fallback content when AI generation fails
   */
  private createExpertFallbackContent(
    lesson: ModuleLesson,
    sectionTitle: string,
    sectionIndex: number,
    request: CourseGenerationRequest
  ): any {
    return {
      sectionTitle,
      introduction: `In this section, we'll explore ${sectionTitle} as part of our comprehensive study of ${lesson.title}. This builds directly on our previous work and is essential for achieving mastery of the learning objectives.`,
      expertTeachingContent: {
        conceptIntroduction: `${sectionTitle} represents a fundamental concept in ${lesson.title}. Understanding this concept is crucial because it forms the foundation for more advanced topics you'll encounter later.`,
        detailedExplanation: `Let me walk you through ${sectionTitle} step by step. 

First, let's establish the context: ${lesson.description}. This concept fits into the broader framework by addressing specific aspects of ${lesson.learningObjectives.join(' and ')}.

The key principle here is that effective learning happens when you can connect new information to what you already know. So let's start with what you likely already understand and build from there.

At its core, ${sectionTitle} involves understanding how different elements work together to create meaningful outcomes. This is similar to how various components in any complex system must coordinate to achieve desired results.

What makes this particularly important for ${request.academicLevel || 'college'} level learners is that you're not just memorizing facts - you're developing the ability to think critically about complex problems and apply systematic approaches to solve them.`,
        expertInsights: [
          `Professional practitioners in this field consider ${sectionTitle} to be fundamental knowledge`,
          `A common mistake is to rush through this concept, but taking time to truly understand it pays dividends later`,
          `This concept connects to broader principles that you'll see repeatedly throughout your studies`
        ],
        practicalExamples: [
          {
            title: `Real-world Application of ${sectionTitle}`,
            context: `This example demonstrates how ${sectionTitle} applies in practical situations`,
            walkthrough: `Step 1: Identify the key components involved. Step 2: Analyze how they interact. Step 3: Apply the principles we've learned to understand the outcome.`,
            keyTakeaways: [`The importance of systematic thinking`, `How theory applies to practice`]
          }
        ],
        realWorldConnections: [
          `Professionals use these concepts daily in their work`,
          `Understanding this prepares you for advanced topics and real-world problem-solving`
        ],
        commonMisconceptions: [
          {
            misconception: `Students often think ${sectionTitle} is just theoretical`,
            correction: `Actually, this concept has immediate practical applications that you can use right away`,
            prevention: `Always look for connections between concepts and real-world applications`
          }
        ]
      },
      checkForUnderstanding: [
        `Can you explain ${sectionTitle} in your own words?`,
        `How would you apply this concept to solve a related problem?`
      ],
      expertSummary: `${sectionTitle} is a cornerstone concept that bridges foundational knowledge with advanced applications. By mastering this, you're building the analytical skills that characterize expert-level thinking in this field.`,
      bridgeToNext: `With a solid understanding of ${sectionTitle}, you're ready to explore how this concept integrates with other elements in our next section.`
    };
  }

  /**
   * Generate lesson assessment after all sections are complete
   */
  private async generateLessonAssessment(task: GenerationTask): Promise<void> {
    if (!task.lessonId) return;

    const { moduleLesson, request } = task.data;
    
    if (!request.assessmentSettings?.includeAssessments) return;

    console.log(`🎯 Generating assessment for lesson: ${moduleLesson.title}`);

    const questionsPerLesson = request.assessmentSettings?.questionsPerLesson || 5;
    const assessmentParams = {
      scope: 'lesson' as const,
      scopeId: task.lessonId,
      baseClassId: request.baseClassId,
      questionCount: questionsPerLesson,
      assessmentTitle: `${moduleLesson.title} - Knowledge Check`,
      assessmentDescription: `Assessment covering key concepts from: ${moduleLesson.description}`,
      questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
      difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
      timeLimit: 30,
      passingScore: 70,
      onProgress: (message: string) => console.log(`📝 Assessment Generation: ${message}`)
    };

    await this.assessmentGenerator.generateAssessment(assessmentParams);
    console.log(`✅ Created assessment for lesson: ${moduleLesson.title}`);
  }

  /**
   * Generate path quiz after all lesson assessments are complete
   */
  private async generatePathQuiz(task: GenerationTask): Promise<void> {
    if (!task.pathId) return;

    const { pathTitle, request } = task.data;
    
    if (!request.assessmentSettings?.includeQuizzes) return;

    console.log(`🎯 Generating quiz for path: ${pathTitle}`);

    const questionsPerQuiz = request.assessmentSettings?.questionsPerQuiz || 10;
    const assessmentParams = {
      scope: 'path' as const,
      scopeId: task.pathId,
      baseClassId: request.baseClassId,
      questionCount: questionsPerQuiz,
      assessmentTitle: `${pathTitle} - Module Quiz`,
      assessmentDescription: `Comprehensive quiz covering all lessons in: ${pathTitle}`,
      questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
      difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
      timeLimit: 60,
      passingScore: 75,
      onProgress: (message: string) => console.log(`📝 Quiz Generation: ${message}`)
    };

    await this.assessmentGenerator.generateAssessment(assessmentParams);
    console.log(`✅ Created quiz for path: ${pathTitle}`);
  }

  /**
   * Generate class exam after all path quizzes are complete
   */
  private async generateClassExam(task: GenerationTask): Promise<void> {
    console.log(`🎯 generateClassExam called for task: ${task.id}`);
    
    if (!task.baseClassId) {
      console.error(`❌ No baseClassId in class exam task: ${task.id}`);
      return;
    }

    const { classTitle, request } = task.data;
    console.log(`📋 Class exam generation details:`, {
      classTitle,
      baseClassId: task.baseClassId,
      includeFinalExam: request.assessmentSettings?.includeFinalExam,
      assessmentSettings: request.assessmentSettings
    });
    
    if (!request.assessmentSettings?.includeFinalExam) {
      console.log(`⏭️ Skipping final exam generation - includeFinalExam is false`);
      return;
    }

    console.log(`🎯 Generating final exam for class: ${classTitle}`);

    const questionsPerExam = request.assessmentSettings?.questionsPerExam || 25;
    const assessmentParams = {
      scope: 'class' as const,
      scopeId: task.baseClassId,
      baseClassId: task.baseClassId,
      questionCount: questionsPerExam,
      assessmentTitle: `${classTitle} - Final Exam`,
      assessmentDescription: `Comprehensive final exam covering all course material from: ${classTitle}`,
      questionTypes: this.getQuestionTypesForLevel(request.academicLevel),
      difficulty: this.mapAcademicLevelToDifficulty(request.academicLevel),
      timeLimit: 120,
      passingScore: 70,
      onProgress: (message: string) => console.log(`📝 Final Exam Generation: ${message}`)
    };

    console.log(`📝 Starting assessment generation with params:`, assessmentParams);

    try {
      await this.assessmentGenerator.generateAssessment(assessmentParams);
      console.log(`✅ Created final exam for class: ${classTitle}`);
    } catch (error) {
      console.error(`❌ Failed to generate class exam:`, error);
      throw error;
    }
  }

  /**
   * Check for completed dependencies and trigger downstream tasks
   */
  private async checkAndTriggerDependentTasks(state: OrchestrationState, completedTask: GenerationTask): Promise<void> {
    // Update progress based on completed tasks
    await this.updateProgressBasedOnCompletedTasks(state);

    // Check lesson completion
    if (completedTask.type === 'lesson_section') {
      const lessonWorkflow = state.lessons.find(l => l.lessonId === completedTask.lessonId);
      if (lessonWorkflow) {
        const allSectionsComplete = lessonWorkflow.sectionTasks.every(taskId => 
          state.completedTasks.has(taskId)
        );
        
        if (allSectionsComplete && !lessonWorkflow.allSectionsComplete) {
          lessonWorkflow.allSectionsComplete = true;
          console.log(`📖 All sections complete for lesson: ${lessonWorkflow.title}`);
          
          // Trigger lesson assessment
          if (lessonWorkflow.assessmentTask) {
            const assessmentTask = state.tasks.get(lessonWorkflow.assessmentTask);
            if (assessmentTask && assessmentTask.status === 'pending') {
              console.log(`🎯 Triggering assessment for lesson: ${lessonWorkflow.title}`);
              setTimeout(() => this.executeTask(state, assessmentTask), 1000); // 1 second delay
            }
          }
        }
      }
    }

    // Check path completion
    if (completedTask.type === 'lesson_assessment') {
      const pathWorkflow = state.paths.find(p => 
        state.lessons.some(l => l.pathId === p.pathId && l.assessmentTask === completedTask.id)
      );
      
      if (pathWorkflow) {
        const allLessonsComplete = pathWorkflow.lessons.every(lessonId => {
          const lesson = state.lessons.find(l => l.lessonId === lessonId);
          return lesson?.assessmentTask && state.completedTasks.has(lesson.assessmentTask);
        });
        
        if (allLessonsComplete && !pathWorkflow.allLessonsComplete) {
          pathWorkflow.allLessonsComplete = true;
          console.log(`🛤️ All lessons complete for path: ${pathWorkflow.title}`);
          
          // Trigger path quiz
          if (pathWorkflow.quizTask) {
            const quizTask = state.tasks.get(pathWorkflow.quizTask);
            if (quizTask && quizTask.status === 'pending') {
              console.log(`📝 Triggering quiz for path: ${pathWorkflow.title}`);
              setTimeout(() => this.executeTask(state, quizTask), 1000); // 1 second delay
            }
          }
        }
      }
    }

    // Check if all path quizzes are complete
    if (completedTask.type === 'path_quiz') {
      console.log(`🎯 Path quiz completed: ${completedTask.id}`);
      
      // Check if all existing quiz tasks are complete (only check tasks that were actually created)
      const existingQuizTasks = Array.from(state.tasks.values())
        .filter(task => task.type === 'path_quiz')
        .map(task => task.id);
      
      console.log(`📊 Existing quiz tasks: ${existingQuizTasks.length}`, existingQuizTasks);
      
      const allExistingQuizzesComplete = existingQuizTasks.every(taskId => 
        state.completedTasks.has(taskId)
      );
      
      console.log(`✅ All existing quizzes complete: ${allExistingQuizzesComplete}`);
      
      if (allExistingQuizzesComplete) {
        const examTask = Array.from(state.tasks.values()).find(task => task.type === 'class_exam');
        if (examTask && examTask.status === 'pending') {
          console.log(`🎓 Triggering class exam: ${examTask.id}`);
          await this.executeTask(state, examTask);
        } else {
          console.log(`⚠️ Class exam task not found or not pending:`, {
            found: !!examTask,
            status: examTask?.status,
            id: examTask?.id
          });
        }
      } else {
        console.log(`⏳ Waiting for more quizzes to complete. Completed: ${state.completedTasks.size}, Total quiz tasks: ${existingQuizTasks.length}`);
      }
    }

    // Check overall completion
    if (completedTask.type === 'class_exam') {
      console.log('🎉 Course generation completed successfully!');
      await this.updateJobStatus(state.jobId, 'completed', 100);
    }
  }

  /**
   * Update progress based on completed tasks with more granular tracking
   */
  private async updateProgressBasedOnCompletedTasks(state: OrchestrationState): Promise<void> {
    const totalTasks = state.tasks.size;
    const completedTasks = state.completedTasks.size;
    
    if (totalTasks === 0) return;
    
    // Calculate base progress
    let progress = Math.floor((completedTasks / totalTasks) * 100);
    
    // Add weight for different task types
    const taskWeights = {
      'lesson_section': 0.4,    // 40% of total weight
      'lesson_assessment': 0.2, // 20% of total weight  
      'path_quiz': 0.2,        // 20% of total weight
      'class_exam': 0.2        // 20% of total weight
    };
    
    let weightedProgress = 0;
    let totalWeight = 0;
    
    for (const [taskType, weight] of Object.entries(taskWeights)) {
      const tasksOfType = Array.from(state.tasks.values()).filter(t => t.type === taskType);
      const completedOfType = tasksOfType.filter(t => state.completedTasks.has(t.id));
      
      if (tasksOfType.length > 0) {
        const typeProgress = (completedOfType.length / tasksOfType.length) * weight;
        weightedProgress += typeProgress;
        totalWeight += weight;
      }
    }
    
    if (totalWeight > 0) {
      progress = Math.floor((weightedProgress / totalWeight) * 100);
    }
    
    // Ensure progress never goes backwards and caps at 99% until truly complete
    progress = Math.min(99, Math.max(progress, 0));
    
    // Only update if progress has changed significantly (at least 1%)
    const currentProgress = await this.getCurrentJobProgress(state.jobId);
    if (Math.abs(progress - currentProgress) >= 1) {
      console.log(`📊 Progress update: ${progress}% (${completedTasks}/${totalTasks} tasks completed)`);
      await this.updateJobStatus(state.jobId, 'processing', progress);
    }
  }

  /**
   * Get current job progress from database
   */
  private async getCurrentJobProgress(jobId: string): Promise<number> {
    try {
      const supabase = this.getSupabaseClient();
      const { data, error } = await supabase
        .from('course_generation_jobs')
        .select('progress_percentage')
        .eq('id', jobId)
        .single();
      
      if (error || !data) return 0;
      return (data as any).progress_percentage || 0;
    } catch (error) {
      console.error('Error getting current progress:', error);
      return 0;
    }
  }

  // Helper methods
  private async cacheKnowledgeBaseContent(outline: CourseOutline, request: CourseGenerationRequest): Promise<void> {
    const cacheKey = `${outline.knowledgeBaseAnalysis.baseClassId}-${request.generationMode || 'kb_supplemented'}`;
    
    if (!this.kbContentCache.has(cacheKey)) {
      console.log('🔍 Caching KB content for orchestrated generation...');
      const courseKbContent = await knowledgeBaseAnalyzer.searchKnowledgeBaseForGeneration(
        outline.knowledgeBaseAnalysis.baseClassId,
        `${request.title} ${request.description || ''}`,
        request.generationMode || 'kb_supplemented',
        { courseScope: 'outline' }
      );
      this.kbContentCache.set(cacheKey, courseKbContent);
      console.log(`📚 Cached ${courseKbContent.length} KB chunks for orchestrated generation`);
    }
  }

  private findLessonInOutline(outline: CourseOutline, lessonTitle: string): ModuleLesson | null {
    for (const courseModule of outline.modules) {
      for (const lesson of courseModule.lessons) {
        if (lesson.title === lessonTitle) {
          return lesson;
        }
      }
    }
    return null;
  }

  private sanitizeContentForDatabase(content: any, maxDepth: number = 6, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth) {
      return typeof content === 'object' ? '[Content too deep - truncated]' : content;
    }
    
    if (content === null || content === undefined) {
      return content;
    }
    
    if (typeof content === 'string') {
      return content.length > 10000 ? content.substring(0, 10000) + '...[truncated]' : content;
    }
    
    if (typeof content === 'number' || typeof content === 'boolean') {
      return content;
    }
    
    if (Array.isArray(content)) {
      // Handle arrays of strings specially - don't increment depth for string arrays
      const isStringArray = content.every(item => typeof item === 'string');
      if (isStringArray) {
        return content.slice(0, 50).map(item => 
          typeof item === 'string' && item.length > 10000 
            ? item.substring(0, 10000) + '...[truncated]' 
            : item
        );
      }
      
      return content.slice(0, 20).map((item, index) => {
        if (index < 15) {
          return this.sanitizeContentForDatabase(item, maxDepth, currentDepth + 1);
        }
        return typeof item === 'object' ? '[Item truncated]' : item;
      });
    }
    
    if (typeof content === 'object') {
      const sanitized: any = {};
      let processedKeys = 0;
      
      for (const [key, value] of Object.entries(content)) {
        if (processedKeys >= 100) { // Increased limit for educational content
          sanitized['__truncated__'] = `${Object.keys(content).length - processedKeys} more properties truncated`;
          break;
        }
        
        if (key.length > 100) continue;
        
        sanitized[key] = this.sanitizeContentForDatabase(value, maxDepth, currentDepth + 1);
        processedKeys++;
      }
      
      return sanitized;
    }
    
    return content;
  }

  private getQuestionTypesForLevel(academicLevel?: string): ('multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching')[] {
    if (!academicLevel) return ['multiple_choice', 'true_false', 'short_answer'];
    
    const level = academicLevel.toLowerCase();
    
    if (level.includes('kindergarten') || level.includes('1st') || level.includes('2nd') || 
        level.includes('3rd') || level.includes('4th') || level.includes('5th')) {
      return ['multiple_choice', 'true_false', 'matching'];
    }
    
    if (level.includes('6th') || level.includes('7th') || level.includes('8th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'matching'];
    }
    
    if (level.includes('9th') || level.includes('10th') || level.includes('11th') || level.includes('12th')) {
      return ['multiple_choice', 'true_false', 'short_answer', 'essay'];
    }
    
    return ['multiple_choice', 'short_answer', 'essay'];
  }

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

  private getAcademicLevelGuidance(academicLevel?: string): string {
    switch (academicLevel) {
      case 'kindergarten':
      case '1st-grade':
      case '2nd-grade':
      case '3rd-grade':
        return `ELEMENTARY GUIDANCE: Use simple language, concrete examples, visual learning, basic questions, familiar scenarios, short engaging lessons.`;
      case '4th-grade':
      case '5th-grade':
      case '6th-grade':
        return `UPPER ELEMENTARY GUIDANCE: Clear age-appropriate language, some abstract concepts with concrete examples, interactive activities, mix of question types, relatable examples.`;
      case '7th-grade':
      case '8th-grade':
        return `MIDDLE SCHOOL GUIDANCE: Grade-appropriate vocabulary, critical thinking development, project-based learning, analysis questions, real-world applications.`;
      case '9th-grade':
      case '10th-grade':
      case '11th-grade':
      case '12th-grade':
        return `HIGH SCHOOL GUIDANCE: Academic vocabulary, analytical skills, research components, higher-order thinking, career/college preparation.`;
      case 'college':
        return `COLLEGE GUIDANCE: Advanced concepts, research skills, independent study, critical analysis, professional applications, scholarly discourse.`;
      case 'graduate':
      case 'professional':
      case 'master':
        return `GRADUATE/PROFESSIONAL GUIDANCE: Professional language, advanced research, theoretical concepts, critical analysis, industry practices, expert-level problem-solving.`;
      default:
        return `GENERAL GUIDANCE: Clear appropriate language, balance theory with practice, varied activities, comprehension and analysis focus, real-world connections.`;
    }
  }

  private async updateJobStatus(jobId: string, status: string, progress: number, result?: any): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();
      const updateData: any = {
        status,
        progress_percentage: progress,
        updated_at: new Date().toISOString()
      };

      if (result !== undefined) {
        updateData.result_data = result;
      }

      await supabase
        .from('course_generation_jobs')
        .update(updateData)
        .eq('id', jobId);
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  }
}

export const courseGenerationOrchestrator = new CourseGenerationOrchestrator(); 