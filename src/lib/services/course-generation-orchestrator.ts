import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { knowledgeBaseAnalyzer, COURSE_GENERATION_MODES } from './knowledge-base-analyzer';
import { AssessmentGenerationService } from './assessment-generation-service';
import type { CourseGenerationRequest, CourseOutline, ModuleLesson } from './course-generator';

export interface GenerationTask {
  id: string;
  type: 'lesson_section' | 'lesson_assessment' | 'lesson_mind_map' | 'lesson_brainbytes' | 'path_quiz' | 'class_exam';
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
  retryCount: number;
}

export interface OrchestrationState {
  jobId: string;
  tasks: Map<string, GenerationTask>;
  completedTasks: Set<string>;
  runningTasks: Set<string>;
  lessons: LessonWorkflow[];
  paths: PathWorkflow[];
  classWorkflow: ClassWorkflow;
  progress: number;
}

export interface LessonWorkflow {
  lessonId: string;
  pathId: string;
  title: string;
  moduleLesson: ModuleLesson;
  sectionTasks: string[];
  assessmentTask?: string;
  mindMapTask?: string;
  brainbytesTask?: string;
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
      timeout: 120000, // 2 minutes timeout
      maxRetries: 2, // Built-in retry mechanism
    });
    this.assessmentGenerator = new AssessmentGenerationService();
  }

  /**
   * Wrapper for OpenAI API calls with custom timeout and retry logic
   */
  private async callOpenAIWithTimeout<T>(
    apiCall: () => Promise<T>,
    operation: string,
    timeoutMs: number = 180000 // 3 minutes default
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`OpenAI API timeout after ${timeoutMs}ms for operation: ${operation}`));
      }, timeoutMs);
    });

    try {
      console.log(`🤖 Starting OpenAI operation: ${operation}`);
      const result = await Promise.race([apiCall(), timeoutPromise]);
      console.log(`✅ OpenAI operation completed: ${operation}`);
      return result;
    } catch (error) {
      console.error(`❌ OpenAI operation failed: ${operation}`, error);
      
      // If it's a timeout or rate limit, throw a specific error
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('rate limit')) {
          throw new Error(`OpenAI ${operation} failed: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  private getSupabaseClient() {
    return createSupabaseServerClient();
  }

  /**
   * Update job status in database
   */
  private async updateJobStatusInDatabase(jobId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (errorMessage) {
        updateData.error_message = errorMessage;
      }
      
      const { error } = await supabase
        .from('course_generation_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) {
        console.error(`Failed to update job status in database:`, error);
      }
    } catch (error) {
      console.error(`Error updating job status in database:`, error);
    }
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

    try {
      // Initialize orchestration state
      const state = await this.initializeOrchestrationState(jobId, outline, request);
      this.orchestrationStates.set(jobId, state);

      // Update job status to running
      await this.updateJobStatusInDatabase(jobId, 'running');

      // Pre-cache knowledge base content
      console.log('🔍 Caching KB content for orchestrated generation...');
      await this.cacheKnowledgeBaseContent(outline, request);

      // Start staggered lesson section generation
      await this.startStaggeredSectionGeneration(state, outline, request);

      console.log('✅ Orchestrated course generation started');
      
      // Set up periodic progress updates
      this.setupProgressMonitoring(state);
      
    } catch (error) {
      console.error('❌ Failed to start orchestrated course generation:', error);
      await this.updateJobStatusInDatabase(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Set up periodic progress monitoring and state persistence
   */
  private setupProgressMonitoring(state: OrchestrationState): void {
    const progressInterval = setInterval(async () => {
      try {
        // Check if orchestration is still active
        if (!this.orchestrationStates.has(state.jobId)) {
          clearInterval(progressInterval);
          return;
        }

        // Update progress in database
        await this.updateProgressBasedOnCompletedTasks(state);
        
        // Check for completion
        const allTasksFinished = Array.from(state.tasks.values()).every(task => 
          task.status === 'completed' || task.status === 'failed'
        );

        if (allTasksFinished) {
          console.log(`🎉 All tasks completed for job ${state.jobId}`);
          await this.updateJobStatusInDatabase(state.jobId, 'completed');
          clearInterval(progressInterval);
          
          // Clean up state after completion
          setTimeout(() => {
            this.orchestrationStates.delete(state.jobId);
            this.kbContentCache.delete(`${state.jobId}-cache`);
          }, 300000); // Keep for 5 minutes after completion
        }
        
      } catch (error) {
        console.error('Progress monitoring error:', error);
      }
    }, 30000); // Update every 30 seconds

    // Clean up after 2 hours regardless
    setTimeout(() => {
      clearInterval(progressInterval);
      if (this.orchestrationStates.has(state.jobId)) {
        console.log(`⏰ Cleaning up orchestration state for job ${state.jobId} after timeout`);
        this.orchestrationStates.delete(state.jobId);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours
  }

  /**
   * Regenerate a specific failed task
   */
  public async regenerateTask(jobId: string, taskId: string): Promise<boolean> {
    const state = this.orchestrationStates.get(jobId);
    if (!state) {
      console.error(`Regenerate failed: No orchestration state found for job ${jobId}`);
      return false;
    }

    const task = state.tasks.get(taskId);
    if (!task) {
      console.error(`Regenerate failed: Task ${taskId} not found in job ${jobId}`);
      return false;
    }

    if (task.status !== 'failed') {
      console.warn(`Regenerate failed: Task ${taskId} is not in 'failed' state. Current state: ${task.status}`);
      return false;
    }

    console.log(`🔄 Regenerating task: ${taskId} for job: ${jobId}`);

    // Reset task state
    task.status = 'pending';
    task.error = undefined;
    task.startTime = undefined;
    task.completeTime = undefined;

    // Re-execute the task
    // Using a timeout to ensure it runs in the next event loop cycle
    setTimeout(() => {
      this.executeTask(state, task);
    }, 100);

    return true;
  }

  /**
   * Get the current state of a generation job
   */
  public getJobState(jobId: string): OrchestrationState | undefined {
    return this.orchestrationStates.get(jobId);
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
          data: { moduleLesson, sectionTitle, outline, request },
          retryCount: 0
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
        data: { moduleLesson, outline, request },
        retryCount: 0
      });

      // Create mind map task (will be triggered at the very end)
      const mindMapTaskId = `mindmap-${lesson.id}`;
      tasks.set(mindMapTaskId, {
        id: mindMapTaskId,
        type: 'lesson_mind_map',
        status: 'pending',
        lessonId: lesson.id,
        pathId: lesson.path_id,
        dependencies: [], // No dependencies - triggered manually at the end
        data: { moduleLesson, outline, request },
        retryCount: 0
      });

      // Create brainbytes task (will be triggered at the very end)
      const brainbytesTaskId = `brainbytes-${lesson.id}`;
      tasks.set(brainbytesTaskId, {
        id: brainbytesTaskId,
        type: 'lesson_brainbytes',
        status: 'pending',
        lessonId: lesson.id,
        pathId: lesson.path_id,
        dependencies: [], // No dependencies - triggered manually at the end
        data: { moduleLesson, outline, request },
        retryCount: 0
      });

      lessonWorkflows.push({
        lessonId: lesson.id,
        pathId: lesson.path_id,
        title: lesson.title,
        moduleLesson,
        sectionTasks,
        assessmentTask: assessmentTaskId,
        mindMapTask: mindMapTaskId,
        brainbytesTask: brainbytesTaskId,
        allSectionsComplete: false
      });
    }

    // Create path workflows and quiz tasks
    for (const path of paths) {
      const pathLessons = lessons.filter(l => l.path_id === path.id);
      
      // Use planned lesson assessment tasks instead of checking database
      const lessonAssessmentTasks = pathLessons.map(l => `assessment-${l.id}`);
      
      console.log(`🛤️ Path ${path.title}:`, {
        totalLessons: pathLessons.length,
        plannedAssessments: lessonAssessmentTasks.length,
        dependencies: lessonAssessmentTasks
      });
      
      // Create path quiz task if assessments are enabled and there are lessons
      const quizTaskId = `quiz-${path.id}`;
      
      // Create quiz task if there are lessons with planned assessments and path quizzes are enabled
      if (lessonAssessmentTasks.length > 0 && request.assessmentSettings?.includeQuizzes !== false) {
        tasks.set(quizTaskId, {
          id: quizTaskId,
          type: 'path_quiz',
          status: 'pending',
          pathId: path.id,
          dependencies: lessonAssessmentTasks,
          data: { pathTitle: path.title, request },
          retryCount: 0
        });

        pathWorkflows.push({
          pathId: path.id,
          title: path.title,
          lessons: pathLessons.map(l => l.id),
          quizTask: quizTaskId,
          allLessonsComplete: false
        });
        
        console.log(`✅ Created quiz task for path: ${path.title} with ${lessonAssessmentTasks.length} planned assessment dependencies`);
      } else {
        // Path has no lessons or path quizzes are disabled
        pathWorkflows.push({
          pathId: path.id,
          title: path.title,
          lessons: pathLessons.map(l => l.id),
          quizTask: undefined, // No quiz task for this path
          allLessonsComplete: lessonAssessmentTasks.length === 0 // Mark as complete if no assessments planned
        });
        
        const reason = lessonAssessmentTasks.length === 0 ? 'no lessons' : 'path quizzes disabled';
        console.log(`⚠️ No quiz task created for path: ${path.title} (${reason})`);
      }
    }

    // Create class workflow and exam task
    const allQuizTasks = pathWorkflows
      .map(p => p.quizTask)
      .filter((task): task is string => task !== undefined);
    
    const examTaskId = `exam-${request.baseClassId}`;
    
    // If there are no quiz tasks, depend on all lesson assessment tasks instead
    const examDependencies = allQuizTasks.length > 0 
      ? allQuizTasks 
      : lessonWorkflows.map(l => l.assessmentTask).filter((task): task is string => task !== undefined);
    
    console.log(`🎓 Creating class exam task:`, {
      examTaskId,
      baseClassId: request.baseClassId,
      dependencies: examDependencies,
      totalPaths: pathWorkflows.length,
      pathsWithQuizzes: allQuizTasks.length,
      includeFinalExam: request.assessmentSettings?.includeFinalExam,
      classTitle: request.title,
      dependencyType: allQuizTasks.length > 0 ? 'quiz_tasks' : 'lesson_assessments'
    });
    
    // Only create exam task if final exam is enabled
    if (request.assessmentSettings?.includeFinalExam !== false) {
      tasks.set(examTaskId, {
        id: examTaskId,
        type: 'class_exam',
        status: 'pending',
        baseClassId: request.baseClassId,
        dependencies: examDependencies,
        data: { classTitle: request.title, request },
        retryCount: 0
      });
    }

    const classWorkflow: ClassWorkflow = {
      baseClassId: request.baseClassId,
      paths: paths.map(p => p.id),
      examTask: request.assessmentSettings?.includeFinalExam !== false ? examTaskId : undefined,
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

    const state: OrchestrationState = {
      jobId,
      tasks,
      completedTasks: new Set(),
      runningTasks: new Set(),
      lessons: lessonWorkflows,
      paths: pathWorkflows,
      classWorkflow,
      progress: 0
    };

    return state;
  }

  /**
   * Start staggered lesson section generation with improved reliability
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

    // Start initial batch of tasks (3 concurrent tasks max to avoid overwhelming OpenAI)
    const maxConcurrent = 3;
    const staggerDelayMs = 8000; // 8 seconds between batches
    
    for (let i = 0; i < Math.min(maxConcurrent, sectionTasks.length); i++) {
      const task = sectionTasks[i];
      console.log(`🚀 Starting initial task ${i + 1}/${maxConcurrent}: ${task.sectionTitle}`);
      
      // Use Promise-based delay instead of setTimeout for better reliability
      this.executeTaskWithDelay(state, task, i * 2000); // 2 second stagger within batch
    }

    // Schedule remaining tasks to start as others complete
    if (sectionTasks.length > maxConcurrent) {
      this.scheduleRemainingTasks(state, sectionTasks.slice(maxConcurrent), staggerDelayMs);
    }
  }

  /**
   * Execute a task with a delay using Promise-based timing
   */
  private async executeTaskWithDelay(state: OrchestrationState, task: GenerationTask, delayMs: number): Promise<void> {
    if (delayMs > 0) {
      console.log(`⏱️ Delaying task ${task.sectionTitle} by ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Don't await here - let tasks run concurrently
    this.executeTask(state, task).catch(error => {
      console.error(`Task execution failed for ${task.id}:`, error);
    });
  }

  /**
   * Schedule remaining tasks to start as capacity becomes available
   */
  private scheduleRemainingTasks(state: OrchestrationState, remainingTasks: GenerationTask[], staggerDelayMs: number): void {
    let taskIndex = 0;
    
    const scheduleNext = () => {
      if (taskIndex >= remainingTasks.length) {
        console.log(`✅ All ${remainingTasks.length} remaining tasks have been scheduled`);
        return;
      }
      
      // Check if we have capacity (less than 3 running tasks)
      if (state.runningTasks.size < 3) {
        const task = remainingTasks[taskIndex];
        console.log(`🚀 Scheduling remaining task ${taskIndex + 1}/${remainingTasks.length}: ${task.sectionTitle}`);
        
        this.executeTask(state, task).catch(error => {
          console.error(`Scheduled task execution failed for ${task.id}:`, error);
        });
        
        taskIndex++;
      }
      
      // Schedule next check
      setTimeout(scheduleNext, staggerDelayMs);
    };
    
    // Start scheduling after initial delay
    setTimeout(scheduleNext, staggerDelayMs);
  }

  /**
   * Execute a specific generation task with timeout monitoring
   */
  private async executeTask(state: OrchestrationState, task: GenerationTask): Promise<void> {
    task.status = 'running';
    task.startTime = new Date();
    state.runningTasks.add(task.id);
    await this.updateProgressBasedOnCompletedTasks(state);

    // Set up task timeout monitoring (10 minutes max per task)
    const taskTimeoutMs = 10 * 60 * 1000; // 10 minutes
    const taskTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task timeout: ${task.type} - ${task.sectionTitle || task.id} exceeded ${taskTimeoutMs}ms`));
      }, taskTimeoutMs);
    });

    while (task.retryCount <= 1) {
      try {
        console.log(`🚀 Starting task: ${task.type} - ${task.sectionTitle || task.id} (attempt ${task.retryCount + 1})`);
        
        // Race the actual task execution against the timeout
        await Promise.race([
          this.executeTaskLogic(task),
          taskTimeoutPromise
        ]);
        
        task.status = 'completed';
        task.completeTime = new Date();
        state.completedTasks.add(task.id);
        state.runningTasks.delete(task.id);
        
        const duration = task.completeTime.getTime() - (task.startTime?.getTime() || 0);
        console.log(`✅ Completed task: ${task.type} - ${task.sectionTitle || task.id} (${Math.round(duration/1000)}s)`);
        
        this.checkAndTriggerDependentTasks(state, task);
        return;

      } catch (error) {
        task.retryCount += 1;
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        
        if (task.retryCount > 1) {
          console.error(`❌ Failed task after retry: ${task.id} (${task.type}):`, errorMessage);
          task.status = 'failed';
          task.completeTime = new Date();
          task.error = errorMessage;
          state.runningTasks.delete(task.id);
          
          // Update job status in database with error
          await this.updateJobStatusInDatabase(state.jobId, 'failed', errorMessage);
          
          this.checkAndTriggerDependentTasks(state, task);
          return;
        } else {
          console.warn(`⚠️ Task failed, retrying: ${task.id} (${task.type}). Attempt: ${task.retryCount}. Error: ${errorMessage}`);
          // Wait 5 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }

  /**
   * Execute the actual task logic (separated for timeout handling)
   */
  private async executeTaskLogic(task: GenerationTask): Promise<void> {
    switch (task.type) {
      case 'lesson_section':
        await this.generateLessonSection(task);
        break;
      case 'lesson_assessment':
        await this.generateLessonAssessment(task);
        break;
      case 'lesson_mind_map':
        await this.generateLessonMindMap(task);
        break;
      case 'lesson_brainbytes':
        await this.generateLessonBrainbytes(task);
        break;
      case 'path_quiz':
        await this.generatePathQuiz(task);
        break;
      case 'class_exam':
        await this.generateClassExam(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Generate a single lesson section with expert-level educational content
   */
  private async generateLessonSection(task: GenerationTask): Promise<void> {
    if (!task.lessonId || task.sectionIndex === undefined) {
      throw new Error('Invalid lesson section task data');
    }

    try {
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
      
      if (!sectionContent) {
        throw new Error('AI failed to generate section content.');
      }

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
    } catch (error) {
      console.error(`Error in generateLessonSection for task ${task.id}:`, error);
      // Re-throw the error to be caught by executeTask
      throw error;
    }
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

    const completion = await this.callOpenAIWithTimeout(
      () => this.openai.chat.completions.create({
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
      }),
      `Section Content Generation: ${sectionTitle}`,
      240000 // 4 minutes for content generation
    );

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
   * Trigger media generation for all lessons at the very end of course generation
   */
  private async triggerFinalMediaGeneration(state: OrchestrationState): Promise<void> {
    console.log('🎬 Starting final media generation for all lessons...');
    
    // Get all lessons that have completed assessments
    const lessonsWithCompletedAssessments = state.lessons.filter(lesson => 
      lesson.assessmentTask && this.isTaskFinished(state, lesson.assessmentTask)
    );
    
    console.log(`📊 Found ${lessonsWithCompletedAssessments.length} lessons ready for media generation`);
    
    // Trigger all media generation tasks with staggered delays
    let delayOffset = 0;
    
    for (const lessonWorkflow of lessonsWithCompletedAssessments) {
      // Trigger mind map generation
      if (lessonWorkflow.mindMapTask) {
        const mindMapTask = state.tasks.get(lessonWorkflow.mindMapTask);
        if (mindMapTask && mindMapTask.status === 'pending') {
          console.log(`🧠 Scheduling mind map generation for lesson: ${lessonWorkflow.title} (delay: ${delayOffset}ms)`);
          setTimeout(() => this.executeTask(state, mindMapTask), delayOffset);
          delayOffset += 2000; // 2 second stagger
        }
      }
      
      // Trigger brainbytes generation
      if (lessonWorkflow.brainbytesTask) {
        const brainbytesTask = state.tasks.get(lessonWorkflow.brainbytesTask);
        if (brainbytesTask && brainbytesTask.status === 'pending') {
          console.log(`🎧 Scheduling brainbytes generation for lesson: ${lessonWorkflow.title} (delay: ${delayOffset}ms)`);
          setTimeout(() => this.executeTask(state, brainbytesTask), delayOffset);
          delayOffset += 2000; // 2 second stagger
        }
      }
    }
    
    // Schedule final completion check after all media generation is triggered
    const finalCompletionDelay = delayOffset + 10000; // Extra 10 seconds for processing
    console.log(`⏰ Scheduling final completion check in ${finalCompletionDelay}ms`);
    
    setTimeout(async () => {
      // Check if all media generation is complete
      const allMediaComplete = state.lessons.every(lesson => {
        const mindMapComplete = !lesson.mindMapTask || this.isTaskFinished(state, lesson.mindMapTask);
        const brainbytesComplete = !lesson.brainbytesTask || this.isTaskFinished(state, lesson.brainbytesTask);
        return mindMapComplete && brainbytesComplete;
      });
      
      if (allMediaComplete) {
        console.log('🎉 All media generation completed! Course generation finished successfully!');
        const taskSummary = this.generateTaskSummary(state);
        await this.updateJobStatus(state.jobId, 'completed', 100, taskSummary);
      } else {
        console.log('⏳ Media generation still in progress, will check again...');
        // Schedule another check in 30 seconds
        setTimeout(() => this.checkFinalCompletion(state), 30000);
      }
    }, finalCompletionDelay);
  }

  /**
   * Check if course generation is fully complete including media generation
   */
  private async checkFinalCompletion(state: OrchestrationState): Promise<void> {
    const allMediaComplete = state.lessons.every(lesson => {
      const mindMapComplete = !lesson.mindMapTask || this.isTaskFinished(state, lesson.mindMapTask);
      const brainbytesComplete = !lesson.brainbytesTask || this.isTaskFinished(state, lesson.brainbytesTask);
      return mindMapComplete && brainbytesComplete;
    });
    
    if (allMediaComplete) {
      console.log('🎉 Course generation completed successfully with all media assets!');
      const taskSummary = this.generateTaskSummary(state);
      await this.updateJobStatus(state.jobId, 'completed', 100, taskSummary);
    } else {
      console.log('⏳ Media generation still in progress, scheduling another check...');
      setTimeout(() => this.checkFinalCompletion(state), 30000);
    }
  }

  /**
   * Generate mind map for lesson after assessment is complete
   */
  private async generateLessonMindMap(task: GenerationTask): Promise<void> {
    if (!task.lessonId) return;

    const { moduleLesson, request } = task.data;
    console.log(`🧠 Generating mind map for lesson: ${moduleLesson.title}`);

    // Add delay to ensure lesson data is committed to database
    await new Promise(resolve => setTimeout(resolve, 3000));

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🧠 Attempt ${retryCount + 1}/${maxRetries} - Generating mind map for lesson: ${task.lessonId}`);
        
              // Construct the API URL for internal requests
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      // Call the existing mind map API directly with internal flag and user ID
      const response = await fetch(`${baseUrl}/api/teach/media/generate/mind-map`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': 'true', // Flag for internal requests
          },
          body: JSON.stringify({
            lessonId: task.lessonId,
            userId: request.userId, // Pass user ID for internal requests
            internal: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`🧠 Mind map API error (${response.status}):`, errorText);
          
          // If it's a lesson not found error, retry after delay
          if (response.status === 500 && errorText.includes('Lesson not found')) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`🧠 Lesson not found, retrying in 5 seconds... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
          }
          
          throw new Error(`Mind map API returned ${response.status}: ${errorText}`);
        }

        console.log(`✅ Created mind map for lesson: ${moduleLesson.title}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        console.error(`🧠 Failed attempt ${retryCount}/${maxRetries} for mind map generation:`, error);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ Failed to generate mind map for lesson ${moduleLesson.title} after ${maxRetries} attempts:`, error);
          // Don't throw error to prevent course generation from failing
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Generate brainbytes podcast for lesson after assessment is complete
   */
  private async generateLessonBrainbytes(task: GenerationTask): Promise<void> {
    if (!task.lessonId) return;

    const { moduleLesson, request } = task.data;
    console.log(`🎧 Generating brainbytes for lesson: ${moduleLesson.title}`);

    // Add delay to ensure lesson data is committed to database
    await new Promise(resolve => setTimeout(resolve, 3000));

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🎧 Attempt ${retryCount + 1}/${maxRetries} - Generating brainbytes for lesson: ${task.lessonId}`);
        
        // Use academic level from request, default to 'college'
        const gradeLevel = request.academicLevel || 'college';
        
              // Construct the API URL for internal requests
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      // Call the existing brainbytes API directly with internal flag and user ID
      const response = await fetch(`${baseUrl}/api/teach/media/generate/podcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': 'true', // Flag for internal requests
          },
          body: JSON.stringify({
            lessonId: task.lessonId,
            gradeLevel: gradeLevel,
            userId: request.userId, // Pass user ID for internal requests
            internal: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`🎧 Brainbytes API error (${response.status}):`, errorText);
          
          // If it's a lesson not found error, retry after delay
          if (response.status === 500 && (errorText.includes('Failed to fetch lesson') || errorText.includes('Lesson not found'))) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`🎧 Lesson not found, retrying in 5 seconds... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
          }
          
          throw new Error(`Brainbytes API returned ${response.status}: ${errorText}`);
        }

        console.log(`✅ Created brainbytes for lesson: ${moduleLesson.title}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        console.error(`🎧 Failed attempt ${retryCount}/${maxRetries} for brainbytes generation:`, error);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ Failed to generate brainbytes for lesson ${moduleLesson.title} after ${maxRetries} attempts:`, error);
          // Don't throw error to prevent course generation from failing
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
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
        const sectionStatuses = lessonWorkflow.sectionTasks.map(taskId => ({
          taskId,
          isFinished: this.isTaskFinished(state, taskId),
          status: state.tasks.get(taskId)?.status
        }));
        
        const allSectionsFinished = lessonWorkflow.sectionTasks.every(taskId => 
          this.isTaskFinished(state, taskId)
        );
        
        console.log(`📝 Lesson section completion check for "${lessonWorkflow.title}":`, {
          completedTaskId: completedTask.id,
          sectionStatuses,
          allSectionsFinished,
          assessmentTask: lessonWorkflow.assessmentTask
        });
        
        if (allSectionsFinished && !lessonWorkflow.allSectionsComplete) {
          lessonWorkflow.allSectionsComplete = true;
          console.log(`📖 All sections finished for lesson: ${lessonWorkflow.title}`);
          
          // Trigger lesson assessment
          if (lessonWorkflow.assessmentTask) {
            const assessmentTask = state.tasks.get(lessonWorkflow.assessmentTask);
            if (assessmentTask && assessmentTask.status === 'pending') {
              console.log(`🎯 Triggering assessment for lesson: ${lessonWorkflow.title}`);
              setTimeout(() => this.executeTask(state, assessmentTask), 1000); // 1 second delay
            } else {
              console.log(`⚠️ Assessment task not available or not pending:`, {
                exists: !!assessmentTask,
                status: assessmentTask?.status,
                taskId: lessonWorkflow.assessmentTask
              });
            }
          }
        }
      }
    }

    // Media generation will be triggered at the very end after all core tasks complete

    // Check path completion
    if (completedTask.type === 'lesson_assessment') {
      const pathWorkflow = state.paths.find(p => 
        state.lessons.some(l => l.pathId === p.pathId && l.assessmentTask === completedTask.id)
      );
      
      if (pathWorkflow) {
        const lessonStatuses = pathWorkflow.lessons.map(lessonId => {
          const lesson = state.lessons.find(l => l.lessonId === lessonId);
          return {
            lessonId,
            title: lesson?.title,
            assessmentTask: lesson?.assessmentTask,
            isFinished: lesson?.assessmentTask ? this.isTaskFinished(state, lesson.assessmentTask) : false
          };
        });
        
        const allLessonsFinished = pathWorkflow.lessons.every(lessonId => {
          const lesson = state.lessons.find(l => l.lessonId === lessonId);
          return lesson?.assessmentTask && this.isTaskFinished(state, lesson.assessmentTask);
        });
        
        console.log(`🛤️ Path lesson completion check for "${pathWorkflow.title}":`, {
          completedTaskId: completedTask.id,
          lessonStatuses,
          allLessonsFinished,
          quizTask: pathWorkflow.quizTask
        });
        
        if (allLessonsFinished && !pathWorkflow.allLessonsComplete) {
          pathWorkflow.allLessonsComplete = true;
          console.log(`🛤️ All lessons finished for path: ${pathWorkflow.title}`);
          
          // Trigger path quiz
          if (pathWorkflow.quizTask) {
            const quizTask = state.tasks.get(pathWorkflow.quizTask);
            if (quizTask && quizTask.status === 'pending') {
              console.log(`📝 Triggering quiz for path: ${pathWorkflow.title}`);
              setTimeout(() => this.executeTask(state, quizTask), 1000); // 1 second delay
            } else {
              console.log(`⚠️ Quiz task not available or not pending:`, {
                exists: !!quizTask,
                status: quizTask?.status,
                taskId: pathWorkflow.quizTask
              });
            }
          }
        }
      }
    }

    // Check exam trigger conditions
    await this.checkExamTriggerConditions(state, completedTask);

    // Check overall completion
    if (completedTask.type === 'class_exam') {
      console.log('🎓 Class exam completed! Starting final media generation...');
      await this.triggerFinalMediaGeneration(state);
    }
  }

  /**
   * Check if exam should be triggered based on completed tasks
   */
  private async checkExamTriggerConditions(state: OrchestrationState, completedTask: GenerationTask): Promise<void> {
    // Only check for exam trigger on quiz or assessment completion
    if (completedTask.type !== 'path_quiz' && completedTask.type !== 'lesson_assessment') {
      return;
    }

    // Check if all existing quiz tasks are complete (only check tasks that were actually created)
    const existingQuizTasks = Array.from(state.tasks.values())
      .filter(task => task.type === 'path_quiz')
      .map(task => task.id);
    
    const allExistingQuizzesFinished = existingQuizTasks.length === 0 || existingQuizTasks.every(taskId => 
      this.isTaskFinished(state, taskId)
    );
    
    // If no quiz tasks exist, check if all lesson assessments are complete
    const allLessonAssessmentsFinished = state.lessons.every(lesson => 
      !lesson.assessmentTask || this.isTaskFinished(state, lesson.assessmentTask)
    );
    
    const shouldTriggerExam = existingQuizTasks.length > 0 
      ? allExistingQuizzesFinished 
      : allLessonAssessmentsFinished;
    
    if (completedTask.type === 'path_quiz') {
      console.log(`🎯 Path quiz completed: ${completedTask.id}`);
    }
    
    console.log(`📊 Exam trigger check:`, {
      quizTasks: existingQuizTasks.length,
      allQuizzesComplete: allExistingQuizzesFinished,
      allAssessmentsComplete: allLessonAssessmentsFinished,
      shouldTriggerExam,
      completedTaskType: completedTask.type,
      completedTaskId: completedTask.id,
      totalCompletedTasks: state.completedTasks.size,
      totalTasks: state.tasks.size,
      lessonAssessmentDetails: state.lessons.map(l => ({
        lessonId: l.lessonId,
        title: l.title,
        assessmentTask: l.assessmentTask,
        isComplete: l.assessmentTask ? this.isTaskFinished(state, l.assessmentTask) : false
      }))
    });
    
    if (shouldTriggerExam) {
      const examTask = Array.from(state.tasks.values()).find(task => task.type === 'class_exam');
      if (examTask && examTask.status === 'pending') {
        console.log(`🎓 Triggering class exam: ${examTask.id}`);
        await this.executeTask(state, examTask);
      } else if (!examTask) {
        console.log(`✅ No final exam configured - starting final media generation...`);
        await this.triggerFinalMediaGeneration(state);
      } else {
        console.log(`⚠️ Class exam task not pending:`, {
          status: examTask?.status,
          id: examTask?.id
        });
      }
    } else {
      const waitingFor = existingQuizTasks.length > 0 ? 'quizzes' : 'assessments';
      console.log(`⏳ Waiting for more ${waitingFor} to complete.`);
    }
  }

  /**
   * Helper to check if a task is finished (completed or failed)
   */
  private isTaskFinished(state: OrchestrationState, taskId: string): boolean {
    if (state.completedTasks.has(taskId)) {
      return true;
    }
    const task = state.tasks.get(taskId);
    return task?.status === 'failed';
  }

  /**
   * Update progress based on completed tasks with more granular tracking
   */
  private async updateProgressBasedOnCompletedTasks(state: OrchestrationState): Promise<void> {
    const tasksArray = Array.from(state.tasks.values());
    const completedTasks = tasksArray.filter(t => t.status === 'completed').length;
    const failedTasks = tasksArray.filter(t => t.status === 'failed').length;
    const runningTasks = state.runningTasks.size;
    const totalCount = state.tasks.size;
    
    // Progress based on completed tasks only (failed tasks don't count toward progress)
    const progress = totalCount > 0 ? Math.round((completedTasks / totalCount) * 100) : 0;
    state.progress = progress;

    try {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase
        .from('course_generation_jobs')
        .update({
          progress_percentage: progress,
          updated_at: new Date().toISOString(),
          result_data: {
            total_tasks: totalCount,
            completed_tasks: completedTasks,
            failed_tasks: failedTasks,
            running_tasks: runningTasks,
            last_update: new Date().toISOString(),
            tasks_summary: tasksArray.map(t => ({
              id: t.id,
              type: t.type,
              status: t.status,
              section_title: t.sectionTitle,
              retry_count: t.retryCount,
              error: t.error
            }))
          }
        })
        .eq('id', state.jobId);
      
      if (error) {
        console.error('Error updating job progress:', error);
      } else {
        console.log(`📊 Progress updated: ${completedTasks}/${totalCount} completed (${progress}%) | Running: ${runningTasks} | Failed: ${failedTasks}`);
      }
    } catch (error) {
      console.error('Error updating progress in database:', error);
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

  /**
   * Generate a summary of task completion data for storage in result_data
   */
  private generateTaskSummary(state: OrchestrationState): any {
    const tasks = Array.from(state.tasks.values());
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    const totalTasks = tasks.length;

    // Calculate generation time
    const allTimes = tasks
      .filter(t => t.startTime && t.completeTime)
      .map(t => ({
        start: t.startTime!.getTime(),
        end: t.completeTime!.getTime()
      }));
    
    const earliestStart = allTimes.length > 0 ? Math.min(...allTimes.map(t => t.start)) : Date.now();
    const latestEnd = allTimes.length > 0 ? Math.max(...allTimes.map(t => t.end)) : Date.now();
    const generationTimeMs = latestEnd - earliestStart;

    // Group tasks by type for detailed breakdown
    const tasksByType = tasks.reduce((acc, task) => {
      if (!acc[task.type]) {
        acc[task.type] = { total: 0, completed: 0, failed: 0 };
      }
      acc[task.type].total++;
      if (task.status === 'completed') acc[task.type].completed++;
      if (task.status === 'failed') acc[task.type].failed++;
      return acc;
    }, {} as Record<string, { total: number; completed: number; failed: number }>);

    return {
      taskSummary: {
        totalItems: totalTasks,
        completedItems: completedTasks.length,
        failedItems: failedTasks.length,
        successRate: totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100,
        generationTimeMs,
        tasksByType,
        hasTaskDetails: true
      },
      completedAt: new Date().toISOString(),
      tasks: tasks.map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        lessonId: task.lessonId,
        pathId: task.pathId,
        sectionTitle: task.sectionTitle,
        error: task.error,
        startTime: task.startTime?.toISOString(),
        completeTime: task.completeTime?.toISOString(),
        retryCount: task.retryCount
      }))
    };
  }
}

export const courseGenerationOrchestrator = new CourseGenerationOrchestrator(); 