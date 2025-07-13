/**
 * Comprehensive Onboarding Configuration
 * 
 * Defines onboarding steps for the most important features and workflows
 * in the Learnology AI LMS platform. Organized by user role and feature category.
 */

import { OnboardingStep } from '@/hooks/useOnboarding';

// =============================================================================
// CORE NAVIGATION & PLATFORM FEATURES
// =============================================================================

export const CORE_ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  // Main Navigation
  'nav-dashboard': {
    id: 'nav-dashboard',
    title: 'Your Dashboard',
    description: 'Start here to see your overview, recent activity, and quick actions. This is your command center for all learning activities.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'navigation'
  },

  'nav-courses': {
    id: 'nav-courses',
    title: 'Courses & Learning',
    description: 'Access all your courses, lessons, and learning paths. Click here to dive into your educational content.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'navigation'
  },

  'nav-knowledge-base': {
    id: 'nav-knowledge-base',
    title: 'Knowledge Base',
    description: 'Upload documents, PDFs, and resources to create AI-powered courses. Your content library starts here.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'navigation'
  },

  // Header Actions
  'header-luna-toggle': {
    id: 'header-luna-toggle',
    title: 'Meet Luna - Your AI Assistant',
    description: 'Click here to open Luna, your intelligent AI tutor. Luna can help with questions, provide explanations, and guide you through any task.',
    placement: 'left',
    actionType: 'action',
    category: 'ai-assistant'
  },

  'header-user-menu': {
    id: 'header-user-menu',
    title: 'Account & Settings',
    description: 'Access your profile, preferences, and account settings. Switch between roles if you have multiple permissions.',
    placement: 'left',
    actionType: 'info',
    category: 'account'
  },

  'header-notifications': {
    id: 'header-notifications',
    title: 'Stay Updated',
    description: 'Get notified about new assignments, course updates, and important announcements.',
    placement: 'bottom',
    actionType: 'info',
    category: 'notifications'
  },

  // Command Palette
  'command-palette': {
    id: 'command-palette',
    title: 'Quick Actions (⌘K)',
    description: 'Press ⌘K (or Ctrl+K) anytime to quickly search, navigate, or perform actions across the platform.',
    placement: 'center',
    actionType: 'feature-highlight',
    category: 'productivity'
  },
};

// =============================================================================
// TEACHER-SPECIFIC ONBOARDING
// =============================================================================

export const TEACHER_ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  // Base Classes & Course Creation
  'create-base-class': {
    id: 'create-base-class',
    title: 'Create Your First Course',
    description: 'Start building amazing educational content. Click here to create a new base class - your course template that can be used for multiple class instances.',
    placement: 'bottom',
    actionType: 'action',
    category: 'content-creation'
  },

  'knowledge-base-upload': {
    id: 'knowledge-base-upload',
    title: 'Upload Your Materials',
    description: 'Transform your existing content into interactive courses. Drag and drop PDFs, documents, or paste URLs to get started.',
    placement: 'center',
    actionType: 'action',
    category: 'content-creation'
  },

  'ai-course-generation': {
    id: 'ai-course-generation',
    title: 'AI Course Generation',
    description: 'Watch the magic happen! Our AI will analyze your materials and generate complete courses with lessons, assessments, and learning paths.',
    placement: 'top',
    actionType: 'feature-highlight',
    category: 'ai-features'
  },

  // Studio & Content Management
  'base-class-studio': {
    id: 'base-class-studio',
    title: 'Course Studio',
    description: 'Your creative workspace for refining courses. Edit lessons, adjust content, and perfect your curriculum with AI assistance.',
    placement: 'top',
    actionType: 'feature-highlight',
    category: 'content-editing'
  },

  'lesson-editor': {
    id: 'lesson-editor',
    title: 'Lesson Editor',
    description: 'Create engaging lessons with rich text, multimedia, and interactive elements. AI helps you enhance content and maintain consistency.',
    placement: 'left',
    actionType: 'feature-highlight',
    category: 'content-editing'
  },

  'add-lesson-section': {
    id: 'add-lesson-section',
    title: 'Add Lesson Sections',
    description: 'Break down complex topics into digestible sections. Each section can include text, images, videos, and interactive elements.',
    placement: 'bottom',
    actionType: 'action',
    category: 'content-editing'
  },

  // Class Management
  'create-class-instance': {
    id: 'create-class-instance',
    title: 'Create Class Instance',
    description: 'Turn your base class into a live course. Set dates, enroll students, and start teaching with your perfectly crafted content.',
    placement: 'right',
    actionType: 'action',
    category: 'class-management'
  },

  'gradebook-access': {
    id: 'gradebook-access',
    title: 'Track Student Progress',
    description: 'Monitor student performance, view assignment submissions, and provide personalized feedback through the intelligent gradebook.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'assessment'
  },

  // Teacher Tools
  'teacher-tools-overview': {
    id: 'teacher-tools-overview',
    title: 'AI Teaching Tools',
    description: 'Access powerful AI generators for creating worksheets, lesson plans, assessments, and more. Streamline your teaching workflow.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'productivity'
  },

  'luna-class-copilot': {
    id: 'luna-class-copilot',
    title: 'Luna Class Co-Pilot',
    description: 'Get intelligent suggestions for improving your courses. Luna analyzes your content and provides pedagogical recommendations.',
    placement: 'left',
    actionType: 'feature-highlight',
    category: 'ai-assistant'
  },
};

// =============================================================================
// STUDENT-SPECIFIC ONBOARDING
// =============================================================================

export const STUDENT_ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  // Course Access & Learning
  'join-class': {
    id: 'join-class',
    title: 'Join Your First Class',
    description: 'Enter your enrollment code to access course materials, assignments, and connect with classmates.',
    placement: 'center',
    actionType: 'action',
    category: 'getting-started'
  },

  'course-navigation': {
    id: 'course-navigation',
    title: 'Navigate Your Course',
    description: 'Use the course tree to explore lessons, complete assignments, and track your progress through the learning path.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'learning'
  },

  'lesson-content': {
    id: 'lesson-content',
    title: 'Interactive Lessons',
    description: 'Engage with rich multimedia content, take notes, and interact with AI-powered learning materials designed just for you.',
    placement: 'left',
    actionType: 'feature-highlight',
    category: 'learning'
  },

  // Study Tools
  'study-space': {
    id: 'study-space',
    title: 'Your Study Space',
    description: 'Create notes, mind maps, and study guides. Your personal learning companion that adapts to your study style.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'study-tools'
  },

  'progress-tracking': {
    id: 'progress-tracking',
    title: 'Track Your Progress',
    description: 'Monitor your learning journey, see completion rates, and identify areas for improvement with detailed analytics.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'progress'
  },

  // AI Learning Assistant
  'luna-student-tutor': {
    id: 'luna-student-tutor',
    title: 'Luna - Your AI Tutor',
    description: 'Ask questions, get explanations, and receive personalized help anytime. Luna adapts to your learning pace and style.',
    placement: 'left',
    actionType: 'feature-highlight',
    category: 'ai-assistant'
  },

  'assessment-taking': {
    id: 'assessment-taking',
    title: 'Take Assessments',
    description: 'Complete quizzes and assignments with AI-powered feedback. Get instant results and personalized improvement suggestions.',
    placement: 'top',
    actionType: 'feature-highlight',
    category: 'assessment'
  },
};

// =============================================================================
// ADMIN-SPECIFIC ONBOARDING
// =============================================================================

export const ADMIN_ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  'school-dashboard': {
    id: 'school-dashboard',
    title: 'School Overview',
    description: 'Monitor school-wide metrics, track student progress, and manage institutional resources from your central dashboard.',
    placement: 'top',
    actionType: 'feature-highlight',
    category: 'management'
  },

  'user-management': {
    id: 'user-management',
    title: 'Manage Users & Roles',
    description: 'Invite teachers, enroll students, and manage permissions. Control who has access to what across your institution.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'management'
  },

  'analytics-overview': {
    id: 'analytics-overview',
    title: 'School Analytics',
    description: 'Gain insights into learning outcomes, engagement patterns, and institutional performance with comprehensive analytics.',
    placement: 'right',
    actionType: 'feature-highlight',
    category: 'analytics'
  },
};

// =============================================================================
// MULTI-STEP ONBOARDING FLOWS
// =============================================================================

export const ONBOARDING_FLOWS = {
  'teacher-first-course': [
    { ...TEACHER_ONBOARDING_STEPS['knowledge-base-upload'], currentStep: 1, totalSteps: 4 },
    { ...TEACHER_ONBOARDING_STEPS['ai-course-generation'], currentStep: 2, totalSteps: 4 },
    { ...TEACHER_ONBOARDING_STEPS['base-class-studio'], currentStep: 3, totalSteps: 4 },
    { ...TEACHER_ONBOARDING_STEPS['create-class-instance'], currentStep: 4, totalSteps: 4 },
  ],

  'student-first-class': [
    { ...STUDENT_ONBOARDING_STEPS['join-class'], currentStep: 1, totalSteps: 3 },
    { ...STUDENT_ONBOARDING_STEPS['course-navigation'], currentStep: 2, totalSteps: 3 },
    { ...STUDENT_ONBOARDING_STEPS['luna-student-tutor'], currentStep: 3, totalSteps: 3 },
  ],

  'platform-basics': [
    { ...CORE_ONBOARDING_STEPS['nav-dashboard'], currentStep: 1, totalSteps: 3 },
    { ...CORE_ONBOARDING_STEPS['header-luna-toggle'], currentStep: 2, totalSteps: 3 },
    { ...CORE_ONBOARDING_STEPS['command-palette'], currentStep: 3, totalSteps: 3 },
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get onboarding steps for a specific user role
 */
export const getOnboardingStepsForRole = (role: string): Record<string, OnboardingStep> => {
  const coreSteps = CORE_ONBOARDING_STEPS;
  
  switch (role) {
    case 'teacher':
      return { ...coreSteps, ...TEACHER_ONBOARDING_STEPS };
    case 'student':
      return { ...coreSteps, ...STUDENT_ONBOARDING_STEPS };
    case 'admin':
    case 'super_admin':
      return { ...coreSteps, ...ADMIN_ONBOARDING_STEPS };
    default:
      return coreSteps;
  }
};

/**
 * Get priority onboarding steps for quick wins
 */
export const getPriorityOnboardingSteps = (role: string): OnboardingStep[] => {
  const prioritySteps = {
    teacher: [
      CORE_ONBOARDING_STEPS['header-luna-toggle'],
      TEACHER_ONBOARDING_STEPS['knowledge-base-upload'],
      TEACHER_ONBOARDING_STEPS['create-base-class'],
      TEACHER_ONBOARDING_STEPS['teacher-tools-overview'],
    ],
    student: [
      CORE_ONBOARDING_STEPS['header-luna-toggle'],
      STUDENT_ONBOARDING_STEPS['join-class'],
      STUDENT_ONBOARDING_STEPS['course-navigation'],
      STUDENT_ONBOARDING_STEPS['study-space'],
    ],
    admin: [
      CORE_ONBOARDING_STEPS['header-luna-toggle'],
      ADMIN_ONBOARDING_STEPS['school-dashboard'],
      ADMIN_ONBOARDING_STEPS['user-management'],
    ],
  };

  return prioritySteps[role as keyof typeof prioritySteps] || [];
};

/**
 * Get onboarding steps by category
 */
export const getOnboardingStepsByCategory = (
  role: string, 
  category: string
): OnboardingStep[] => {
  const allSteps = getOnboardingStepsForRole(role);
  return Object.values(allSteps).filter(step => step.category === category);
}; 