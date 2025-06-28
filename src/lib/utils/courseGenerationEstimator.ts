export interface CourseGenerationEstimate {
  estimatedMinutes: number;
  taskBreakdown: {
    kbAnalysis: number;
    outlineGeneration: number;
    pathCreation: number;
    lessonGeneration: number;
    assessmentCreation: number;
  };
  totalTasks: number;
}

export interface CourseGenerationParams {
  estimatedWeeks: number;
  lessonsPerWeek: number;
  includeAssessments: boolean;
  includeQuizzes: boolean;
  includeFinalExam: boolean;
  lessonDetailLevel: 'basic' | 'detailed' | 'comprehensive';
  generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  documentCount?: number;
}

/**
 * Estimates course generation time based on configuration parameters
 */
export function estimateCourseGenerationTime(params: CourseGenerationParams): CourseGenerationEstimate {
  const {
    estimatedWeeks,
    lessonsPerWeek,
    includeAssessments,
    includeQuizzes,
    includeFinalExam,
    lessonDetailLevel,
    generationMode,
    documentCount = 0
  } = params;

  // Calculate total lessons and paths
  const totalLessons = estimatedWeeks * lessonsPerWeek;
  const estimatedPaths = Math.max(3, Math.ceil(estimatedWeeks / 3)); // Roughly 3-4 weeks per path

  // Base time estimates (in minutes) - optimized based on actual performance
  const baseTimeEstimates = {
    kbAnalysis: {
      kb_only: Math.min(1.6, 0.4 + (documentCount * 0.08)), // Reduced from 2, 0.5, 0.1
      kb_priority: Math.min(2.4, 0.8 + (documentCount * 0.12)), // Reduced from 3, 1, 0.15
      kb_supplemented: Math.min(2, 0.64 + (documentCount * 0.096)) // Reduced from 2.5, 0.8, 0.12
    },
    outlineGeneration: {
      basic: 1.2, // Reduced from 1.5
      detailed: 2, // Reduced from 2.5
      comprehensive: 3.2 // Reduced from 4
    },
    perPath: {
      basic: 0.8, // Reduced from 1
      detailed: 1.2, // Reduced from 1.5
      comprehensive: 2 // Reduced from 2.5
    },
    perLesson: {
      basic: 0.64, // Reduced from 0.8
      detailed: 0.96, // Reduced from 1.2
      comprehensive: 1.6 // Reduced from 2
    },
    perAssessment: {
      lesson: 0.4, // Reduced from 0.5
      quiz: 0.8, // Reduced from 1
      exam: 1.2 // Reduced from 1.5
    }
  };

  // Calculate component times
  const kbAnalysis = baseTimeEstimates.kbAnalysis[generationMode];
  const outlineGeneration = baseTimeEstimates.outlineGeneration[lessonDetailLevel];
  const pathCreation = estimatedPaths * baseTimeEstimates.perPath[lessonDetailLevel];
  const lessonGeneration = totalLessons * baseTimeEstimates.perLesson[lessonDetailLevel];

  // Calculate assessment creation time
  let assessmentCreation = 0;
  if (includeAssessments) {
    assessmentCreation += totalLessons * baseTimeEstimates.perAssessment.lesson;
  }
  if (includeQuizzes) {
    assessmentCreation += estimatedPaths * baseTimeEstimates.perAssessment.quiz;
  }
  if (includeFinalExam) {
    assessmentCreation += baseTimeEstimates.perAssessment.exam;
  }

  // Calculate total tasks for progress tracking
  let totalTasks = 2; // KB analysis + outline generation
  totalTasks += estimatedPaths; // Path creation
  totalTasks += totalLessons; // Lesson generation
  if (includeAssessments) totalTasks += totalLessons; // Lesson assessments
  if (includeQuizzes) totalTasks += estimatedPaths; // Path quizzes
  if (includeFinalExam) totalTasks += 1; // Final exam

  const taskBreakdown = {
    kbAnalysis,
    outlineGeneration,
    pathCreation,
    lessonGeneration,
    assessmentCreation
  };

  // Calculate total time and apply 30-minute cap
  const rawEstimatedMinutes = kbAnalysis + outlineGeneration + pathCreation + lessonGeneration + assessmentCreation;
  const estimatedMinutes = Math.min(30, Math.ceil(rawEstimatedMinutes)); // Cap at 30 minutes

  return {
    estimatedMinutes,
    taskBreakdown,
    totalTasks
  };
}

/**
 * Formats estimated time as a human-readable string
 */
export function formatEstimatedTime(minutes: number): string {
  if (minutes < 1) {
    return 'Less than 1 minute';
  } else if (minutes < 60) {
    return `${Math.ceil(minutes)} minute${Math.ceil(minutes) !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.ceil(minutes % 60);
    
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  }
}

/**
 * Gets a descriptive message about what affects generation time
 */
export function getTimeEstimateExplanation(params: CourseGenerationParams): string {
  const factors: string[] = [];
  
  if (params.estimatedWeeks > 20) {
    factors.push('extensive course duration');
  }
  
  if (params.lessonsPerWeek > 4) {
    factors.push('high lesson frequency');
  }
  
  if (params.lessonDetailLevel === 'comprehensive') {
    factors.push('comprehensive detail level');
  }
  
  if (params.includeAssessments && params.includeQuizzes && params.includeFinalExam) {
    factors.push('complete assessment suite');
  }
  
  if (params.generationMode === 'kb_only' && (params.documentCount || 0) > 15) {
    factors.push('large knowledge base');
  }

  if (factors.length === 0) {
    return 'This course will generate quickly! Feel free to continue with other tasks.';
  } else if (factors.length === 1) {
    return `Generation may take a bit longer due to ${factors[0]}, but will still complete efficiently.`;
  } else {
    const lastFactor = factors.pop();
    return `Generation time may be extended due to ${factors.join(', ')} and ${lastFactor}, but will complete within 30 minutes.`;
  }
} 