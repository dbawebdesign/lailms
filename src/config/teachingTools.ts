import { TeachingTool } from '@/types/teachingTools';

export const teachingTools: TeachingTool[] = [
  {
    id: 'rubric-generator',
    name: 'Rubric Generator',
    description: 'Create detailed assessment rubrics with customizable criteria and performance levels',
    category: 'assessment',
    icon: 'ClipboardList',
    complexity: 'simple',
    estimatedTime: '2-3 minutes',
    outputFormats: ['pdf', 'docx', 'html'],
    keywords: ['assessment', 'grading', 'criteria', 'evaluation', 'standards'],
    isPopular: true,
    apiEndpoint: '/api/tools/rubric',
    inputFields: [
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'e.g., Mathematics, English, Science',
        required: true,
        description: 'The subject area for this assessment'
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'assessmentType',
        label: 'Assessment Type',
        type: 'select',
        options: ['Project', 'Essay', 'Presentation', 'Lab Report', 'Research Paper', 'Creative Work', 'Performance Task'],
        required: true
      },
      {
        id: 'criteria',
        label: 'Assessment Criteria',
        type: 'textarea',
        placeholder: 'List the main criteria you want to assess (e.g., content knowledge, organization, creativity)',
        required: true,
        description: 'Enter each criterion on a new line or separated by commas'
      },
      {
        id: 'performanceLevels',
        label: 'Number of Performance Levels',
        type: 'range',
        min: 3,
        max: 6,
        defaultValue: 4,
        description: 'How many performance levels (e.g., 4 = Excellent, Good, Satisfactory, Needs Improvement)'
      }
    ],
    examples: [
      'Science Fair Project Rubric for Grade 8',
      'Essay Writing Rubric for High School English',
      'Art Project Assessment for Elementary'
    ],
    tips: [
      'Be specific with your criteria for more detailed rubrics',
      'Consider including both content and process criteria',
      'Use language appropriate for your grade level'
    ]
  },
  {
    id: 'lesson-generator',
    name: 'Lesson Generator',
    description: 'Generate comprehensive lesson plans with objectives, activities, and assessment strategies',
    category: 'planning',
    icon: 'BookOpen',
    complexity: 'intermediate',
    estimatedTime: '3-5 minutes',
    outputFormats: ['pdf', 'docx', 'html'],
    keywords: ['lesson plan', 'curriculum', 'activities', 'objectives', 'teaching'],
    isPopular: true,
    apiEndpoint: '/api/tools/lesson',
    inputFields: [
      {
        id: 'topic',
        label: 'Lesson Topic',
        type: 'text',
        placeholder: 'e.g., Photosynthesis, World War II, Fractions',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'duration',
        label: 'Lesson Duration',
        type: 'select',
        options: ['30 minutes', '45 minutes', '60 minutes', '90 minutes', '2 hours'],
        required: true
      },
      {
        id: 'learningObjectives',
        label: 'Learning Objectives',
        type: 'textarea',
        placeholder: 'What should students know or be able to do by the end of this lesson?',
        required: true
      },
      {
        id: 'priorKnowledge',
        label: 'Prior Knowledge Required',
        type: 'textarea',
        placeholder: 'What concepts should students already understand?'
      },
      {
        id: 'standards',
        label: 'Educational Standards',
        type: 'text',
        placeholder: 'e.g., CCSS.MATH.5.NF.1, NGSS.5-PS1-1'
      }
    ],
    examples: [
      'Introduction to Ecosystems for 5th Grade',
      'Shakespeare\'s Romeo and Juliet for 9th Grade',
      'Basic Geometry Shapes for 2nd Grade'
    ],
    tips: [
      'Include specific, measurable learning objectives',
      'Consider different learning styles in your activities',
      'Plan for formative assessment throughout the lesson'
    ]
  },
  {
    id: 'quiz-generator',
    name: 'Quiz Generator',
    description: 'Create engaging quizzes with various question types and automatic answer keys',
    category: 'assessment',
    icon: 'HelpCircle',
    complexity: 'simple',
    estimatedTime: '2-4 minutes',
    outputFormats: ['pdf', 'html', 'json'],
    keywords: ['quiz', 'test', 'questions', 'assessment', 'multiple choice'],
    isPopular: true,
    apiEndpoint: '/api/tools/quiz',
    inputFields: [
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'e.g., Biology, History, Algebra',
        required: true
      },
      {
        id: 'topic',
        label: 'Topic/Chapter',
        type: 'text',
        placeholder: 'e.g., Cell Structure, American Revolution',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'questionCount',
        label: 'Number of Questions',
        type: 'range',
        min: 5,
        max: 50,
        defaultValue: 15
      },
      {
        id: 'questionTypes',
        label: 'Question Types',
        type: 'multiselect',
        options: ['Multiple Choice', 'True/False', 'Short Answer', 'Fill in the Blank', 'Matching'],
        defaultValue: ['Multiple Choice', 'True/False']
      },
      {
        id: 'difficulty',
        label: 'Difficulty Level',
        type: 'select',
        options: ['Easy', 'Medium', 'Hard', 'Mixed'],
        defaultValue: 'Medium'
      }
    ],
    examples: [
      'Photosynthesis Quiz for 7th Grade Science',
      'Revolutionary War Quiz for 8th Grade History',
      'Fractions and Decimals Quiz for 5th Grade Math'
    ],
    tips: [
      'Mix different question types for variety',
      'Include questions at different cognitive levels',
      'Review generated questions for accuracy and clarity'
    ]
  },
  {
    id: 'iep-generator',
    name: 'IEP Generator',
    description: 'Generate Individualized Education Program goals and accommodations',
    category: 'planning',
    icon: 'Users',
    complexity: 'advanced',
    estimatedTime: '5-8 minutes',
    outputFormats: ['pdf', 'docx'],
    keywords: ['IEP', 'special education', 'accommodations', 'goals', 'disabilities'],
    apiEndpoint: '/api/tools/iep',
    inputFields: [
      {
        id: 'studentAge',
        label: 'Student Age',
        type: 'number',
        min: 3,
        max: 22,
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['PreK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'disabilityCategory',
        label: 'Disability Category',
        type: 'select',
        options: [
          'Autism Spectrum Disorder',
          'Intellectual Disability',
          'Specific Learning Disability',
          'Speech or Language Impairment',
          'Emotional Disturbance',
          'Multiple Disabilities',
          'Other Health Impairment',
          'Orthopedic Impairment',
          'Visual Impairment',
          'Hearing Impairment',
          'Traumatic Brain Injury'
        ],
        required: true
      },
      {
        id: 'academicAreas',
        label: 'Academic Areas of Need',
        type: 'multiselect',
        options: ['Reading', 'Writing', 'Mathematics', 'Science', 'Social Studies', 'Communication'],
        required: true
      },
      {
        id: 'currentPerformance',
        label: 'Current Academic Performance',
        type: 'textarea',
        placeholder: 'Describe the student\'s current performance levels and abilities',
        required: true
      },
      {
        id: 'behavioralNeeds',
        label: 'Behavioral/Social Needs',
        type: 'textarea',
        placeholder: 'Describe any behavioral or social-emotional needs'
      }
    ],
    examples: [
      'Reading Goals for Student with Dyslexia',
      'Communication Goals for Student with Autism',
      'Math Goals for Student with Intellectual Disability'
    ],
    tips: [
      'Be specific about current performance levels',
      'Include measurable and achievable goals',
      'Consider the student\'s strengths and interests'
    ]
  },
  {
    id: 'report-comments',
    name: 'Report Card Comments',
    description: 'Generate personalized, constructive report card comments for students',
    category: 'communication',
    icon: 'MessageSquare',
    complexity: 'simple',
    estimatedTime: '1-2 minutes',
    outputFormats: ['text', 'docx'],
    keywords: ['report card', 'comments', 'feedback', 'progress', 'communication'],
    apiEndpoint: '/api/tools/report-comments',
    inputFields: [
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'e.g., Mathematics, Language Arts, Science',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'studentPerformance',
        label: 'Overall Performance Level',
        type: 'select',
        options: ['Exceeds Expectations', 'Meets Expectations', 'Approaching Expectations', 'Below Expectations'],
        required: true
      },
      {
        id: 'strengths',
        label: 'Student Strengths',
        type: 'textarea',
        placeholder: 'What does the student do well in this subject?',
        required: true
      },
      {
        id: 'areasForGrowth',
        label: 'Areas for Growth',
        type: 'textarea',
        placeholder: 'What areas need improvement or focus?'
      },
      {
        id: 'tone',
        label: 'Comment Tone',
        type: 'select',
        options: ['Encouraging', 'Professional', 'Detailed', 'Concise'],
        defaultValue: 'Encouraging'
      }
    ],
    examples: [
      'Math Progress Comments for 3rd Grader',
      'Reading Development Comments for 1st Grader',
      'Science Performance Comments for 6th Grader'
    ],
    tips: [
      'Focus on specific behaviors and achievements',
      'Include both strengths and growth areas',
      'Use positive, constructive language'
    ]
  },
  {
    id: 'multiple-explanations',
    name: 'Multiple Explanations',
    description: 'Generate different ways to explain the same concept for diverse learners',
    category: 'differentiation',
    icon: 'Lightbulb',
    complexity: 'intermediate',
    estimatedTime: '2-3 minutes',
    outputFormats: ['text', 'html', 'pdf'],
    keywords: ['differentiation', 'explanations', 'learning styles', 'concepts', 'multiple perspectives'],
    apiEndpoint: '/api/tools/multiple-explanations',
    inputFields: [
      {
        id: 'concept',
        label: 'Concept to Explain',
        type: 'text',
        placeholder: 'e.g., Photosynthesis, Fractions, Democracy',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'explanationTypes',
        label: 'Types of Explanations',
        type: 'multiselect',
        options: ['Visual/Diagram', 'Analogy/Metaphor', 'Step-by-Step', 'Real-World Example', 'Hands-On Activity', 'Story/Narrative'],
        defaultValue: ['Visual/Diagram', 'Analogy/Metaphor', 'Real-World Example']
      },
      {
        id: 'learnerTypes',
        label: 'Target Learner Types',
        type: 'multiselect',
        options: ['Visual Learners', 'Auditory Learners', 'Kinesthetic Learners', 'Reading/Writing Learners', 'ELL Students', 'Advanced Learners'],
        defaultValue: ['Visual Learners', 'Auditory Learners', 'Kinesthetic Learners']
      },
      {
        id: 'contextualInfo',
        label: 'Additional Context',
        type: 'textarea',
        placeholder: 'Any specific context or background information about your students?'
      }
    ],
    examples: [
      'Different ways to explain multiplication to 3rd graders',
      'Multiple explanations of the water cycle for 4th grade',
      'Various approaches to teaching fractions to 5th graders'
    ],
    tips: [
      'Consider your students\' diverse learning preferences',
      'Include both concrete and abstract approaches',
      'Test different explanations with different students'
    ]
  },
  {
    id: 'lesson-hooks',
    name: 'Lesson Hooks',
    description: 'Create engaging opening activities to capture student attention and interest',
    category: 'content-creation',
    icon: 'Zap',
    complexity: 'simple',
    estimatedTime: '1-2 minutes',
    outputFormats: ['text', 'html'],
    keywords: ['engagement', 'opening', 'hook', 'attention', 'motivation', 'starter'],
    isNew: true,
    apiEndpoint: '/api/tools/lesson-hooks',
    inputFields: [
      {
        id: 'topic',
        label: 'Lesson Topic',
        type: 'text',
        placeholder: 'e.g., Ancient Egypt, Chemical Reactions, Poetry',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'hookTypes',
        label: 'Types of Hooks',
        type: 'multiselect',
        options: ['Question/Poll', 'Surprising Fact', 'Story/Anecdote', 'Video Clip', 'Hands-On Activity', 'Game/Competition', 'Mystery/Problem'],
        defaultValue: ['Question/Poll', 'Surprising Fact', 'Hands-On Activity']
      },
      {
        id: 'timeLimit',
        label: 'Hook Duration',
        type: 'select',
        options: ['2-3 minutes', '5 minutes', '7-10 minutes', '15 minutes'],
        defaultValue: '5 minutes'
      },
      {
        id: 'materials',
        label: 'Available Materials/Technology',
        type: 'text',
        placeholder: 'e.g., projector, tablets, lab equipment, art supplies'
      }
    ],
    examples: [
      'Engaging hooks for geometry lessons',
      'Creative openers for literature discussions',
      'Science experiment hooks for chemistry'
    ],
    tips: [
      'Connect hooks to students\' interests and experiences',
      'Keep hooks short but impactful',
      'Ensure hooks relate clearly to the lesson objective'
    ]
  },
  {
    id: 'content-leveler',
    name: 'Content Leveler',
    description: 'Adapt existing content to different reading levels and complexity',
    category: 'differentiation',
    icon: 'BarChart3',
    complexity: 'intermediate',
    estimatedTime: '3-4 minutes',
    outputFormats: ['text', 'html', 'pdf'],
    keywords: ['differentiation', 'reading level', 'complexity', 'adaptation', 'accessibility'],
    apiEndpoint: '/api/tools/content-leveler',
    inputFields: [
      {
        id: 'originalContent',
        label: 'Original Content',
        type: 'textarea',
        placeholder: 'Paste the text you want to adapt to different levels',
        required: true
      },
      {
        id: 'targetGradeLevels',
        label: 'Target Grade Levels',
        type: 'multiselect',
        options: ['K-1', '2-3', '4-5', '6-8', '9-12'],
        required: true
      },
      {
        id: 'contentType',
        label: 'Content Type',
        type: 'select',
        options: ['Reading Passage', 'Instructions', 'Explanation', 'Story', 'Informational Text'],
        required: true
      },
      {
        id: 'focusAreas',
        label: 'Adaptation Focus',
        type: 'multiselect',
        options: ['Vocabulary', 'Sentence Length', 'Concept Complexity', 'Examples', 'Background Knowledge'],
        defaultValue: ['Vocabulary', 'Sentence Length']
      },
      {
        id: 'maintainAccuracy',
        label: 'Maintain Scientific/Historical Accuracy',
        type: 'select',
        options: ['Yes', 'No'],
        defaultValue: 'Yes'
      }
    ],
    examples: [
      'Simplify a science article for elementary students',
      'Create multiple versions of historical text',
      'Adapt math word problems for different levels'
    ],
    tips: [
      'Review adapted content for accuracy',
      'Consider cultural relevance when adapting',
      'Test with students at target levels'
    ]
  },
  {
    id: 'mindmap-generator',
    name: 'Mind Map Generator',
    description: 'Create visual mind maps to organize concepts and show relationships',
    category: 'visual-aids',
    icon: 'Brain',
    complexity: 'simple',
    estimatedTime: '2-3 minutes',
    outputFormats: ['image', 'html', 'pdf'],
    keywords: ['mind map', 'visual', 'concepts', 'organization', 'brainstorming'],
    apiEndpoint: '/api/tools/mindmap',
    inputFields: [
      {
        id: 'centralTopic',
        label: 'Central Topic',
        type: 'text',
        placeholder: 'e.g., Ecosystems, World War I, Poetry',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'subtopics',
        label: 'Key Subtopics (Optional)',
        type: 'textarea',
        placeholder: 'List main subtopics, one per line (or leave blank for AI suggestions)'
      },
      {
        id: 'style',
        label: 'Visual Style',
        type: 'select',
        options: ['Colorful', 'Professional', 'Simple', 'Creative'],
        defaultValue: 'Colorful'
      },
      {
        id: 'complexity',
        label: 'Complexity Level',
        type: 'select',
        options: ['Basic', 'Detailed', 'Comprehensive'],
        defaultValue: 'Detailed'
      }
    ],
    examples: [
      'Ecosystem relationships for 5th grade science',
      'Character analysis for literature class',
      'Government branches for social studies'
    ],
    tips: [
      'Use colors to group related concepts',
      'Keep text concise on each branch',
      'Start simple and add details as needed'
    ]
  },
  {
    id: 'brain-bytes',
    name: 'BrainBytes Generator',
    description: 'Create bite-sized, engaging educational content for quick learning moments',
    category: 'content-creation',
    icon: 'Sparkles',
    complexity: 'simple',
    estimatedTime: '1-2 minutes',
    outputFormats: ['text', 'html', 'image'],
    keywords: ['micro-learning', 'quick facts', 'engagement', 'bite-sized', 'fun facts'],
    isNew: true,
    apiEndpoint: '/api/tools/brain-bytes',
    inputFields: [
      {
        id: 'topic',
        label: 'Topic/Subject',
        type: 'text',
        placeholder: 'e.g., Space, Dinosaurs, Mathematics, History',
        required: true
      },
      {
        id: 'gradeLevel',
        label: 'Grade Level',
        type: 'select',
        options: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        required: true
      },
      {
        id: 'byteTypes',
        label: 'Types of BrainBytes',
        type: 'multiselect',
        options: ['Fun Facts', 'Did You Know?', 'Quick Quiz', 'Brain Teaser', 'Connection to Today', 'Amazing Stat'],
        defaultValue: ['Fun Facts', 'Did You Know?']
      },
      {
        id: 'count',
        label: 'Number of BrainBytes',
        type: 'range',
        min: 3,
        max: 15,
        defaultValue: 5
      },
      {
        id: 'format',
        label: 'Format Preference',
        type: 'select',
        options: ['Text Only', 'Text with Emojis', 'Visual Cards', 'Social Media Style'],
        defaultValue: 'Text with Emojis'
      }
    ],
    examples: [
      'Amazing ocean facts for 4th graders',
      'Cool math connections for middle school',
      'Historical fun facts for high school'
    ],
    tips: [
      'Use BrainBytes as warm-ups or transitions',
      'Share one per day to maintain engagement',
      'Encourage students to find their own BrainBytes'
    ]
  }
]; 