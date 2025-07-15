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
      'Math Problem-Solving Rubric for Grade 5',
      'Creative Writing Assessment for High School',
      'Science Lab Report Evaluation for Middle School'
    ],
    tips: [
      'Start with 3-4 main criteria for clarity',
      'Use specific, observable behaviors in descriptions',
      'Align criteria with learning objectives'
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
    apiEndpoint: '/api/tools/iep-generator',
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
        label: 'Current Performance Level',
        type: 'textarea',
        placeholder: 'Describe the student\'s current academic and functional performance',
        required: true
      },
      {
        id: 'behavioralNeeds',
        label: 'Behavioral Considerations',
        type: 'textarea',
        placeholder: 'Any behavioral supports or interventions needed (optional)'
      }
    ],
    examples: [
      'Reading goals for student with dyslexia',
      'Communication objectives for autism spectrum',
      'Math accommodations for intellectual disability'
    ],
    tips: [
      'Be specific about current performance levels',
      'Focus on measurable, achievable goals',
      'Consider both academic and functional needs'
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
    keywords: ['report cards', 'comments', 'feedback', 'communication', 'parents'],
    apiEndpoint: '/api/tools/report-comments',
    inputFields: [
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'e.g., Mathematics, English, Science',
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
        label: 'Student Performance',
        type: 'select',
        options: ['Exceeds Expectations', 'Meets Expectations', 'Approaching Expectations', 'Below Expectations'],
        required: true
      },
      {
        id: 'strengths',
        label: 'Student Strengths',
        type: 'textarea',
        placeholder: 'What is the student doing well? (e.g., participates actively, shows creativity)',
        required: true
      },
      {
        id: 'areasForGrowth',
        label: 'Areas for Growth',
        type: 'textarea',
        placeholder: 'What areas need improvement? (e.g., organization, following directions)'
      },
      {
        id: 'tone',
        label: 'Comment Tone',
        type: 'select',
        options: ['Encouraging', 'Professional', 'Supportive', 'Direct'],
        defaultValue: 'Encouraging'
      }
    ],
    examples: [
      'Positive math progress comment',
      'Reading improvement suggestions',
      'Science participation feedback'
    ],
    tips: [
      'Balance positive feedback with growth areas',
      'Use specific examples when possible',
      'Keep language parent-friendly'
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
      'Multiple ways to explain fractions',
      'Different approaches to photosynthesis',
      'Various explanations for democracy'
    ],
    tips: [
      'Consider your students\' backgrounds and interests',
      'Use familiar analogies and examples',
      'Provide both concrete and abstract explanations'
    ]
  },
  {
    id: 'lesson-hooks',
    name: 'Lesson Hooks',
    description: 'Create engaging opening activities to capture student attention and interest',
    category: 'content-creation',
    icon: 'Sparkles',
    complexity: 'simple',
    estimatedTime: '1-2 minutes',
    outputFormats: ['text', 'html'],
    keywords: ['engagement', 'opening', 'attention', 'motivation', 'interest'],
    isNew: true,
    apiEndpoint: '/api/tools/lesson-hooks',
    inputFields: [
      {
        id: 'topic',
        label: 'Lesson Topic',
        type: 'text',
        placeholder: 'e.g., The Solar System, Persuasive Writing, Algebra',
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
        label: 'Hook Types',
        type: 'multiselect',
        options: ['Question', 'Story', 'Demonstration', 'Game', 'Video', 'Mystery', 'Real-World Connection'],
        defaultValue: ['Question', 'Story', 'Real-World Connection']
      },
      {
        id: 'timeLimit',
        label: 'Time Available',
        type: 'select',
        options: ['2-3 minutes', '5 minutes', '10 minutes', '15 minutes'],
        defaultValue: '5 minutes'
      },
      {
        id: 'materials',
        label: 'Available Materials',
        type: 'textarea',
        placeholder: 'What materials or technology do you have available? (optional)'
      }
    ],
    examples: [
      'Engaging math lesson starter',
      'Science experiment hook',
      'History mystery opening'
    ],
    tips: [
      'Connect to students\' interests and experiences',
      'Create curiosity and questions',
      'Keep it brief but impactful'
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
    apiEndpoint: '/api/tools/mindmap-generator',
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
    description: 'Create standalone 2-3 minute educational podcasts on any topic, hosted by Luna',
    category: 'content-creation',
    icon: 'Sparkles',
    complexity: 'simple',
    estimatedTime: '1-2 minutes',
    outputFormats: ['audio', 'mp3'],
    keywords: ['podcast', 'audio', 'educational', 'bite-sized', 'luna'],
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
      }
    ],
    examples: [
      'Amazing ocean facts for 4th graders',
      'Cool math connections for middle school',
      'Historical fun facts for high school'
    ],
    tips: [
      'Choose topics that are engaging and age-appropriate',
      'Perfect for warm-ups, transitions, or independent listening',
      'Luna will create an educational and entertaining 2-3 minute podcast'
    ]
  }
]; 