import { Question, Assessment, User, BaseClass } from '@/types/assessment'

export const mockUsers: Partial<User>[] = [
  {
    id: 'test-student-1',
    email: 'student1@test.com',
    role: 'student',
    first_name: 'John',
    last_name: 'Doe',
  },
  {
    id: 'test-student-2',
    email: 'student2@test.com',
    role: 'student',
    first_name: 'Jane',
    last_name: 'Smith',
  },
  {
    id: 'test-teacher-1',
    email: 'teacher1@test.com',
    role: 'teacher',
    first_name: 'Professor',
    last_name: 'Wilson',
  },
  {
    id: 'test-admin-1',
    email: 'admin1@test.com',
    role: 'admin',
    first_name: 'Admin',
    last_name: 'User',
  },
]

export const mockBaseClass: Partial<BaseClass> = {
  id: 'test-base-class-1',
  title: 'Introduction to Computer Science',
  description: 'A comprehensive introduction to computer science fundamentals',
  created_by: 'test-teacher-1',
  assessment_config: {
    enabled: true,
    auto_generate: true,
    question_types: ['multiple_choice', 'short_answer', 'essay'],
    difficulty_levels: ['easy', 'medium', 'hard'],
    questions_per_assessment: 10,
    time_limit_minutes: 60,
    passing_score: 70,
  },
}

export const mockQuestions: Partial<Question>[] = [
  {
    id: 'test-question-1',
    base_class_id: 'test-base-class-1',
    question_text: 'What is the time complexity of binary search?',
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    correct_answer: 'O(log n)',
    sample_response: 'The time complexity of binary search is O(log n) because we eliminate half of the search space in each iteration.',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    points: 10,
    tags: ['algorithms', 'complexity', 'search'],
    content_source: 'lesson',
    source_id: 'lesson-1',
    created_by: 'test-teacher-1',
  },
  {
    id: 'test-question-2',
    base_class_id: 'test-base-class-1',
    question_text: 'Explain the difference between a stack and a queue.',
    question_type: 'short_answer',
    difficulty_level: 'easy',
    correct_answer: 'Stack follows LIFO (Last In, First Out) principle while Queue follows FIFO (First In, First Out) principle.',
    sample_response: 'A stack is a data structure that follows the LIFO principle, where the last element added is the first one to be removed. A queue follows the FIFO principle, where the first element added is the first one to be removed.',
    points: 15,
    tags: ['data-structures', 'stack', 'queue'],
    content_source: 'path',
    source_id: 'path-1',
    created_by: 'test-teacher-1',
  },
  {
    id: 'test-question-3',
    base_class_id: 'test-base-class-1',
    question_text: 'Write a detailed essay on the importance of software testing in the development lifecycle.',
    question_type: 'essay',
    difficulty_level: 'hard',
    correct_answer: 'Software testing is crucial for ensuring quality, reliability, and user satisfaction.',
    sample_response: 'Software testing plays a vital role in the development lifecycle by identifying bugs early, ensuring code quality, validating requirements, and providing confidence in the software\'s reliability. It includes various types like unit testing, integration testing, and user acceptance testing.',
    points: 25,
    tags: ['testing', 'software-development', 'quality'],
    content_source: 'class',
    source_id: 'test-base-class-1',
    created_by: 'test-teacher-1',
  },
]

export const mockAssessment: Partial<Assessment> = {
  id: 'test-assessment-1',
  title: 'Midterm Exam - Computer Science Fundamentals',
  description: 'Comprehensive assessment covering the first half of the course',
  base_class_id: 'test-base-class-1',
  assessment_type: 'exam',
  time_limit_minutes: 90,
  passing_score: 75,
  max_attempts: 2,
  is_published: true,
  availability_start: new Date('2025-06-01T09:00:00Z'),
  availability_end: new Date('2025-06-30T23:59:59Z'),
  instructions: 'Read each question carefully. You have 90 minutes to complete this assessment.',
  created_by: 'test-teacher-1',
}

export const mockAssessmentAttempt = {
  id: 'test-attempt-1',
  assessment_id: 'test-assessment-1',
  user_id: 'test-student-1',
  started_at: new Date('2025-06-15T10:00:00Z'),
  status: 'in_progress',
  current_question_index: 0,
}

export const mockAssessmentAnswers = [
  {
    id: 'test-answer-1',
    attempt_id: 'test-attempt-1',
    question_id: 'test-question-1',
    answer_text: 'O(log n)',
    is_correct: true,
    points_earned: 10,
    submitted_at: new Date('2025-06-15T10:05:00Z'),
  },
  {
    id: 'test-answer-2',
    attempt_id: 'test-attempt-1',
    question_id: 'test-question-2',
    answer_text: 'Stack is LIFO, Queue is FIFO',
    is_correct: true,
    points_earned: 15,
    submitted_at: new Date('2025-06-15T10:10:00Z'),
  },
]

export const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            question_text: 'What is a variable in programming?',
            question_type: 'multiple_choice',
            difficulty_level: 'easy',
            correct_answer: 'A storage location with an associated name',
            options: [
              'A storage location with an associated name',
              'A type of loop',
              'A function parameter',
              'A programming language'
            ],
            points: 5,
            tags: ['variables', 'programming-basics']
          },
          {
            question_text: 'Explain the concept of object-oriented programming.',
            question_type: 'short_answer',
            difficulty_level: 'medium',
            correct_answer: 'OOP is a programming paradigm based on objects that contain data and methods.',
            points: 10,
            tags: ['oop', 'programming-paradigms']
          }
        ])
      }
    }
  ]
}

export const mockCourseContent = {
  lesson: {
    id: 'lesson-1',
    title: 'Introduction to Algorithms',
    content: 'An algorithm is a step-by-step procedure for solving a problem. Binary search is an efficient algorithm for finding an item from a sorted list of items.',
    base_class_id: 'test-base-class-1',
  },
  path: {
    id: 'path-1',
    title: 'Data Structures Fundamentals',
    lessons: [
      {
        title: 'Stacks and Queues',
        content: 'Stacks and queues are fundamental data structures. A stack follows LIFO principle while a queue follows FIFO principle.',
      }
    ],
    base_class_id: 'test-base-class-1',
  }
}

// Helper function to create test data with timestamps
export const createTestData = () => {
  const now = new Date()
  return {
    users: mockUsers.map(user => ({
      ...user,
      created_at: now,
      updated_at: now,
    })),
    baseClass: {
      ...mockBaseClass,
      created_at: now,
      updated_at: now,
    },
    questions: mockQuestions.map(question => ({
      ...question,
      created_at: now,
      updated_at: now,
    })),
    assessment: {
      ...mockAssessment,
      created_at: now,
      updated_at: now,
    },
    attempt: {
      ...mockAssessmentAttempt,
      created_at: now,
      updated_at: now,
    },
    answers: mockAssessmentAnswers.map(answer => ({
      ...answer,
      created_at: now,
      updated_at: now,
    })),
  }
} 