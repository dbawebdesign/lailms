import type { OrchestrationState, GenerationTask } from '@/lib/services/course-generation-orchestrator';

export interface ProgressPhase {
  name: string;
  startPercent: number;
  endPercent: number;
  description: string;
}

export interface CourseGenerationProgressConfig {
  phases: ProgressPhase[];
  getPhaseProgress: (phase: string, current: number, total: number) => number;
  calculateOverallProgress: (phaseProgress: Record<string, { current: number; total: number }>) => number;
}

// Unified progress phases for course generation
export const COURSE_GENERATION_PHASES: ProgressPhase[] = [
  {
    name: 'upload',
    startPercent: 0,
    endPercent: 10,
    description: 'Uploading and processing documents'
  },
  {
    name: 'analysis',
    startPercent: 10,
    endPercent: 20,
    description: 'Analyzing knowledge base content'
  },
  {
    name: 'outline',
    startPercent: 20,
    endPercent: 30,
    description: 'Generating course outline and structure'
  },
  {
    name: 'paths',
    startPercent: 30,
    endPercent: 40,
    description: 'Creating learning paths and lessons'
  },
  {
    name: 'sections',
    startPercent: 40,
    endPercent: 70,
    description: 'Generating lesson content sections'
  },
  {
    name: 'assessments',
    startPercent: 70,
    endPercent: 80,
    description: 'Creating lesson assessments and quizzes'
  },
  {
    name: 'path_assessments',
    startPercent: 80,
    endPercent: 85,
    description: 'Generating path quizzes and final exams'
  },
  {
    name: 'media',
    startPercent: 85,
    endPercent: 100,
    description: 'Generating mind maps and audio content'
  }
];

export class CourseGenerationProgressCalculator {
  private phases: ProgressPhase[];

  constructor(phases: ProgressPhase[] = COURSE_GENERATION_PHASES) {
    this.phases = phases;
  }

  /**
   * Calculate progress for a specific phase
   */
  getPhaseProgress(phaseName: string, current: number, total: number): number {
    const phase = this.phases.find(p => p.name === phaseName);
    if (!phase || total === 0) return 0;

    const phaseProgressPercent = Math.min(current / total, 1) * 100;
    const phaseRange = phase.endPercent - phase.startPercent;
    return phase.startPercent + (phaseProgressPercent / 100) * phaseRange;
  }

  /**
   * Calculate overall progress across all phases
   */
  calculateOverallProgress(phaseProgress: Record<string, { current: number; total: number }>): number {
    let totalProgress = 0;

    for (const phase of this.phases) {
      const progress = phaseProgress[phase.name];
      if (progress) {
        const phasePercent = this.getPhaseProgress(phase.name, progress.current, progress.total);
        totalProgress = Math.max(totalProgress, phasePercent);
      }
    }

    return Math.min(Math.round(totalProgress), 100);
  }

  /**
   * Get current phase based on progress percentage
   */
  getCurrentPhase(progressPercent: number): ProgressPhase | null {
    for (let i = this.phases.length - 1; i >= 0; i--) {
      const phase = this.phases[i];
      if (progressPercent >= phase.startPercent) {
        return phase;
      }
    }
    return this.phases[0];
  }

  /**
   * Calculate progress from orchestrator state
   */
  calculateProgressFromOrchestrationState(state: any): {
    overallProgress: number;
    currentPhase: ProgressPhase | null;
    phaseBreakdown: Record<string, { current: number; total: number; progress: number }>;
    detailedMessage: string;
  } {
    const tasksArray: GenerationTask[] = Array.from(state.tasks.values());
    
    // Count tasks by type
    const taskCounts = {
      sections: { 
        current: tasksArray.filter(t => t.type === 'lesson_section' && t.status === 'completed').length,
        total: tasksArray.filter(t => t.type === 'lesson_section').length
      },
      assessments: {
        current: tasksArray.filter(t => t.type === 'lesson_assessment' && t.status === 'completed').length,
        total: tasksArray.filter(t => t.type === 'lesson_assessment').length
      },
      path_assessments: {
        current: tasksArray.filter(t => ['path_quiz', 'class_exam'].includes(t.type) && t.status === 'completed').length,
        total: tasksArray.filter(t => ['path_quiz', 'class_exam'].includes(t.type)).length
      },
      media: {
        current: tasksArray.filter(t => ['lesson_mind_map', 'lesson_brainbytes'].includes(t.type) && t.status === 'completed').length,
        total: tasksArray.filter(t => ['lesson_mind_map', 'lesson_brainbytes'].includes(t.type)).length
      }
    };

    // Calculate phase progress
    const phaseBreakdown: Record<string, { current: number; total: number; progress: number }> = {};
    
    // Assume earlier phases are complete if we have tasks running
    const hasActiveTasks = tasksArray.some(t => ['pending', 'running'].includes(t.status));
    
    if (hasActiveTasks || taskCounts.sections.total > 0) {
      phaseBreakdown.upload = { current: 1, total: 1, progress: 100 };
      phaseBreakdown.analysis = { current: 1, total: 1, progress: 100 };
      phaseBreakdown.outline = { current: 1, total: 1, progress: 100 };
      phaseBreakdown.paths = { current: 1, total: 1, progress: 100 };
    }

    // Active phases based on task progress
    if (taskCounts.sections.total > 0) {
      phaseBreakdown.sections = {
        ...taskCounts.sections,
        progress: this.getPhaseProgress('sections', taskCounts.sections.current, taskCounts.sections.total)
      };
    }

    if (taskCounts.assessments.total > 0) {
      phaseBreakdown.assessments = {
        ...taskCounts.assessments,
        progress: this.getPhaseProgress('assessments', taskCounts.assessments.current, taskCounts.assessments.total)
      };
    }

    if (taskCounts.path_assessments.total > 0) {
      phaseBreakdown.path_assessments = {
        ...taskCounts.path_assessments,
        progress: this.getPhaseProgress('path_assessments', taskCounts.path_assessments.current, taskCounts.path_assessments.total)
      };
    }

    // Only show media progress if lesson sections are actually complete
    // This prevents jumping to 85% when media tasks are created but sections aren't done
    const allSectionsComplete = taskCounts.sections.total > 0 && taskCounts.sections.current === taskCounts.sections.total;
    if (taskCounts.media.total > 0 && allSectionsComplete) {
      phaseBreakdown.media = {
        ...taskCounts.media,
        progress: this.getPhaseProgress('media', taskCounts.media.current, taskCounts.media.total)
      };
    }

    // Calculate overall progress
    const overallProgress = this.calculateOverallProgress(phaseBreakdown);
    const currentPhase = this.getCurrentPhase(overallProgress);

    // Generate detailed message
    let detailedMessage = '';
    if (currentPhase) {
      const phaseData = phaseBreakdown[currentPhase.name];
      if (phaseData) {
        detailedMessage = `${currentPhase.description} (${phaseData.current}/${phaseData.total} completed)`;
      } else {
        detailedMessage = currentPhase.description;
      }
    }

    return {
      overallProgress,
      currentPhase,
      phaseBreakdown,
      detailedMessage
    };
  }

  /**
   * Get estimated time remaining based on current progress and elapsed time
   */
  getEstimatedTimeRemaining(
    currentProgress: number, 
    startTime: Date, 
    currentTime: Date = new Date()
  ): string {
    if (currentProgress <= 0) return 'Calculating...';
    if (currentProgress >= 100) return 'Complete';

    const elapsedMs = currentTime.getTime() - startTime.getTime();
    const progressRatio = currentProgress / 100;
    const estimatedTotalMs = elapsedMs / progressRatio;
    const remainingMs = estimatedTotalMs - elapsedMs;

    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    
    if (remainingMinutes < 1) return 'Less than 1 minute';
    if (remainingMinutes < 60) return `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
  }
}

export const courseProgressCalculator = new CourseGenerationProgressCalculator(); 