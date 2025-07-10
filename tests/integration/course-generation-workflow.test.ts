/**
 * Course Generation Workflow Integration Tests
 * 
 * This test suite validates the complete course generation process:
 * 1. Create base class with knowledge base content
 * 2. Trigger course generation with assessment settings
 * 3. Verify creation of paths, lessons, sections, and content
 * 4. Validate generation of lesson assessments, path quizzes, and class exams
 * 5. Test different generation modes and academic levels
 * 6. Verify integration with the new assessment system
 */

import { 
  TestDatabase, 
  APITestHelper, 
  TestAssertions, 
  PerformanceTestHelper,
  setupTestEnvironment, 
  teardownTestEnvironment 
} from '../utils/testHelpers'

describe('Course Generation Workflow Integration Tests', () => {
  let testDb: TestDatabase
  let baseClassId: string
  let generationJobId: string
  
  beforeAll(async () => {
    testDb = await setupTestEnvironment()
  })

  afterAll(async () => {
    await teardownTestEnvironment(testDb)
  })

  describe('1. Base Class and Knowledge Base Setup', () => {
    test('should create base class with assessment configuration', async () => {
      const baseClassData = {
        title: 'Advanced JavaScript Programming',
        description: 'Comprehensive course covering modern JavaScript development',
        assessment_config: {
          enabled: true,
          auto_generate: true,
          question_types: ['multiple_choice', 'short_answer', 'essay'],
          difficulty_levels: ['easy', 'medium', 'hard'],
          questions_per_assessment: 5,
          time_limit_minutes: 45,
          passing_score: 75,
        }
      }

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/create-base-class',
        {
          method: 'POST',
          body: JSON.stringify(baseClassData)
        }
      )

      TestAssertions.assertAPIResponse(response, 201)
      TestAssertions.assertSuccessResponse(data)
      expect(data.data.baseClass).toHaveProperty('id')
      expect(data.data.baseClass.assessment_config).toMatchObject(baseClassData.assessment_config)
      
      baseClassId = data.data.baseClass.id
    })

    test('should upload knowledge base documents', async () => {
      const documents = [
        {
          title: 'JavaScript Fundamentals',
          content: 'JavaScript is a versatile programming language. Variables can be declared using let, const, or var. Functions are first-class objects in JavaScript.',
          type: 'text'
        },
        {
          title: 'Async Programming in JavaScript',
          content: 'Asynchronous programming in JavaScript uses promises, async/await, and callbacks. Event loop manages asynchronous operations.',
          type: 'text'
        },
        {
          title: 'ES6+ Features',
          content: 'Modern JavaScript includes arrow functions, destructuring, modules, classes, and template literals. These features improve code readability.',
          type: 'text'
        }
      ]

      for (const doc of documents) {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/knowledge-base/documents',
          {
            method: 'POST',
            body: JSON.stringify({
              ...doc,
              baseClassId
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 201)
        TestAssertions.assertSuccessResponse(data)
      }

      // Verify documents were created
      const { data: documentsData } = await testDb.query('knowledge_base_documents', {
        eq: ['base_class_id', baseClassId]
      })
      expect(documentsData.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('2. Course Generation with Full Assessment Integration', () => {
    test('should initiate comprehensive course generation with all assessment types', async () => {
      // Mock OpenAI responses for course generation
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  title: 'Advanced JavaScript Programming',
                  description: 'Comprehensive JavaScript course',
                  estimatedDurationWeeks: 8,
                  learningObjectives: [
                    'Master JavaScript fundamentals',
                    'Understand asynchronous programming',
                    'Apply modern ES6+ features'
                  ],
                  modules: [
                    {
                      id: 'module-1',
                      title: 'JavaScript Fundamentals',
                      description: 'Core JavaScript concepts',
                      order: 1,
                      estimatedDurationWeeks: 2,
                      learningObjectives: ['Variables and data types', 'Functions and scope'],
                      lessons: [
                        {
                          id: 'lesson-1',
                          title: 'Variables and Data Types',
                          description: 'Understanding JavaScript variables',
                          order: 1,
                          estimatedDurationHours: 2,
                          contentType: 'lecture',
                          learningObjectives: ['Declare variables', 'Understand data types'],
                          contentOutline: ['Variable declaration', 'Data type overview', 'Type coercion']
                        }
                      ],
                      assessments: [
                        {
                          id: 'assessment-1',
                          title: 'JavaScript Fundamentals Quiz',
                          type: 'quiz',
                          order: 1,
                          estimatedDurationMinutes: 30,
                          masteryThreshold: 75
                        }
                      ]
                    }
                  ]
                })
              }
            }]
          })
        })

      const courseGenerationRequest = {
        baseClassId,
        title: 'Advanced JavaScript Programming',
        description: 'Comprehensive JavaScript course with assessments',
        generationMode: 'kb_priority',
        estimatedDurationWeeks: 8,
        academicLevel: 'college',
        lessonDetailLevel: 'detailed',
        targetAudience: 'Computer science students',
        lessonsPerWeek: 2,
        learningObjectives: [
          'Master JavaScript fundamentals',
          'Understand asynchronous programming',
          'Apply modern ES6+ features'
        ],
        assessmentSettings: {
          includeAssessments: true, // Lesson-level assessments
          includeQuizzes: true, // Path-level quizzes
          includeFinalExam: true, // Class-level exam
          assessmentDifficulty: 'medium',
          questionsPerLesson: 3,
          questionsPerQuiz: 8,
          questionsPerExam: 15
        }
      }

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify(courseGenerationRequest)
        }
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      expect(data.jobId).toBeTruthy()
      expect(data.status).toBe('queued')
      
      generationJobId = data.jobId
    }, 60000) // Extended timeout for course generation

    test('should monitor course generation progress', async () => {
      // Poll generation status until completion
      let attempts = 0
      const maxAttempts = 30 // 30 attempts with 2-second intervals = 1 minute max
      let jobStatus = 'queued'

      while (attempts < maxAttempts && !['completed', 'failed'].includes(jobStatus)) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/knowledge-base/generation-status/${generationJobId}`
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        
        jobStatus = data.data.job.status
        expect(data.data.job.progress).toBeGreaterThanOrEqual(0)
        expect(data.data.job.progress).toBeLessThanOrEqual(100)

        console.log(`Generation progress: ${data.data.job.progress}% (${jobStatus})`)
        attempts++
      }

      expect(jobStatus).toBe('completed')
    }, 120000) // 2-minute timeout for generation completion
  })

  describe('3. Verify Generated Course Structure', () => {
    test('should have created learning paths (modules)', async () => {
      const { data: paths } = await testDb.query('learning_paths', {
        eq: ['base_class_id', baseClassId]
      })

      expect(paths.length).toBeGreaterThan(0)
      paths.forEach((path: any) => {
        expect(path).toHaveProperty('title')
        expect(path).toHaveProperty('description')
        expect(path).toHaveProperty('order_index')
        expect(path.base_class_id).toBe(baseClassId)
      })
    })

    test('should have created lessons with content', async () => {
      const { data: lessons } = await testDb.query('lessons', {
        join: 'learning_paths!inner(base_class_id)',
        eq: ['learning_paths.base_class_id', baseClassId]
      })

      expect(lessons.length).toBeGreaterThan(0)
      lessons.forEach((lesson: any) => {
        expect(lesson).toHaveProperty('title')
        expect(lesson).toHaveProperty('description')
        expect(lesson).toHaveProperty('path_id')
        expect(lesson).toHaveProperty('order_index')
      })
    })

    test('should have created lesson sections with generated content', async () => {
      const { data: sections } = await testDb.query('lesson_sections', {
        join: 'lessons!inner(path_id), learning_paths!inner(base_class_id)',
        eq: ['learning_paths.base_class_id', baseClassId]
      })

      expect(sections.length).toBeGreaterThan(0)
      sections.forEach((section: any) => {
        expect(section).toHaveProperty('title')
        expect(section).toHaveProperty('content')
        expect(section).toHaveProperty('lesson_id')
        expect(section).toHaveProperty('order_index')
        expect(section.content).toBeTruthy()
        expect(section.content.length).toBeGreaterThan(50) // Substantial content
      })
    })
  })

  describe('4. Verify Assessment Generation Integration', () => {
    test('should have created lesson-level assessments (knowledge checks)', async () => {
      // Check if lesson questions were created using the new assessment system
      const { data: questions } = await testDb.query('questions', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['content_source', 'eq', 'lesson']
        ]
      })

      expect(questions.length).toBeGreaterThan(0)
      questions.forEach((question: any) => {
        TestAssertions.assertValidQuestion(question)
        expect(question.content_source).toBe('lesson')
        expect(question.source_id).toBeTruthy() // Should reference lesson ID
        expect(question.base_class_id).toBe(baseClassId)
      })

      // Check if lesson assessments were created
      const { data: assessments } = await testDb.query('assessments', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['assessment_type', 'eq', 'lesson_assessment']
        ]
      })

      expect(assessments.length).toBeGreaterThan(0)
      assessments.forEach((assessment: any) => {
        TestAssertions.assertValidAssessment(assessment)
        expect(assessment.assessment_type).toBe('lesson_assessment')
        expect(assessment.base_class_id).toBe(baseClassId)
      })
    })

    test('should have created path-level quizzes (module assessments)', async () => {
      // Check for path-level questions
      const { data: questions } = await testDb.query('questions', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['content_source', 'eq', 'path']
        ]
      })

      expect(questions.length).toBeGreaterThan(0)
      questions.forEach((question: any) => {
        TestAssertions.assertValidQuestion(question)
        expect(question.content_source).toBe('path')
        expect(question.source_id).toBeTruthy() // Should reference path ID
      })

      // Check for path assessments
      const { data: assessments } = await testDb.query('assessments', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['assessment_type', 'eq', 'path_assessment']
        ]
      })

      expect(assessments.length).toBeGreaterThan(0)
      assessments.forEach((assessment: any) => {
        TestAssertions.assertValidAssessment(assessment)
        expect(assessment.assessment_type).toBe('path_assessment')
      })
    })

    test('should have created class-level final exam', async () => {
      // Check for class-level questions
      const { data: questions } = await testDb.query('questions', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['content_source', 'eq', 'class']
        ]
      })

      expect(questions.length).toBeGreaterThan(0)
      questions.forEach((question: any) => {
        TestAssertions.assertValidQuestion(question)
        expect(question.content_source).toBe('class')
        expect(question.source_id).toBe(baseClassId)
      })

      // Check for class assessment
      const { data: assessments } = await testDb.query('assessments', {
        filters: [
          ['base_class_id', 'eq', baseClassId],
          ['assessment_type', 'eq', 'class_assessment']
        ]
      })

      expect(assessments.length).toBeGreaterThan(0)
      const finalExam = assessments[0]
      TestAssertions.assertValidAssessment(finalExam)
      expect(finalExam.assessment_type).toBe('class_assessment')
      expect(finalExam.title).toContain('Final')
    })

    test('should have created assessment-question relationships', async () => {
      // Get all assessments for this base class
      const { data: assessments } = await testDb.query('assessments', {
        eq: ['base_class_id', baseClassId]
      })

      expect(assessments.length).toBeGreaterThan(0)

      // Check that each assessment has associated questions
      for (const assessment of assessments) {
        const { data: assessmentQuestions } = await testDb.query('assessment_questions', {
          eq: ['assessment_id', assessment.id]
        })

        expect(assessmentQuestions.length).toBeGreaterThan(0)
        
        // Verify question references are valid
        for (const aq of assessmentQuestions) {
          const { data: question } = await testDb.query('questions', {
            eq: ['id', aq.question_id]
          })
          expect(question.length).toBe(1)
          expect(question[0].base_class_id).toBe(baseClassId)
        }
      }
    })
  })

  describe('5. Test Assessment Functionality Integration', () => {
    let lessonAssessmentId: string
    let pathQuizId: string
    let finalExamId: string

    beforeAll(async () => {
      // Get assessment IDs for testing
      const { data: assessments } = await testDb.query('assessments', {
        eq: ['base_class_id', baseClassId]
      })

      lessonAssessmentId = assessments.find((a: any) => a.assessment_type === 'lesson_assessment')?.id
      pathQuizId = assessments.find((a: any) => a.assessment_type === 'path_assessment')?.id
      finalExamId = assessments.find((a: any) => a.assessment_type === 'class_assessment')?.id

      expect(lessonAssessmentId).toBeTruthy()
      expect(pathQuizId).toBeTruthy()
      expect(finalExamId).toBeTruthy()
    })

    test('should be able to take lesson assessment', async () => {
      // Start assessment attempt
      const { response: startResponse, data: startData } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            assessmentId: lessonAssessmentId,
            userId: 'test-student-1'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(startResponse, 201)
      TestAssertions.assertSuccessResponse(startData)
      
      const attemptId = startData.data.attempt.id
      const questions = startData.data.questions

      expect(questions.length).toBeGreaterThan(0)

      // Submit answers for all questions
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        let answerText = 'Test answer'
        
        if (question.question_type === 'multiple_choice' && question.options) {
          const correctOption = question.options.find((opt: any) => opt.is_correct)
          answerText = correctOption ? correctOption.option_text : question.options[0].option_text
        }

        const { response: answerResponse } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments/attempt',
          {
            method: 'PUT',
            body: JSON.stringify({
              attemptId,
              questionId: question.id,
              answerText,
              questionIndex: i
            })
          },
          'test-student-1'
        )

        TestAssertions.assertAPIResponse(answerResponse, 200)
      }

      // Complete assessment
      const { response: completeResponse, data: completeData } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            attemptId,
            action: 'complete'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(completeResponse, 200)
      TestAssertions.assertSuccessResponse(completeData)
      expect(completeData.data.result.status).toBe('completed')
      expect(completeData.data.result.score).toBeGreaterThanOrEqual(0)
    })

    test('should be able to take path quiz', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            assessmentId: pathQuizId,
            userId: 'test-student-1'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(response, 201)
      TestAssertions.assertSuccessResponse(data)
      expect(data.data.questions.length).toBeGreaterThan(0)
      
      // Verify this is a path-level assessment
      const { data: assessmentData } = await testDb.query('assessments', {
        eq: ['id', pathQuizId]
      })
      expect(assessmentData[0].assessment_type).toBe('path_assessment')
    })

    test('should be able to take final exam', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            assessmentId: finalExamId,
            userId: 'test-student-1'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(response, 201)
      TestAssertions.assertSuccessResponse(data)
      expect(data.data.questions.length).toBeGreaterThan(0)
      
      // Verify this is a class-level assessment
      const { data: assessmentData } = await testDb.query('assessments', {
        eq: ['id', finalExamId]
      })
      expect(assessmentData[0].assessment_type).toBe('class_assessment')
    })
  })

  describe('6. Test Different Generation Modes', () => {
    test('should generate course with kb_only mode', async () => {
      // Create another base class for kb_only testing
      const { data: baseClassData } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/create-base-class',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Python Programming - KB Only',
            description: 'Python course using only knowledge base content'
          })
        }
      )

      const kbOnlyBaseClassId = baseClassData.data.baseClass.id

      // Upload comprehensive knowledge base content
      const documents = [
        {
          title: 'Python Basics',
          content: 'Python is a high-level programming language. Variables are created by assignment. Python uses indentation for code blocks.',
          baseClassId: kbOnlyBaseClassId
        },
        {
          title: 'Python Data Structures',
          content: 'Python has built-in data structures: lists, tuples, dictionaries, and sets. Lists are mutable, tuples are immutable.',
          baseClassId: kbOnlyBaseClassId
        }
      ]

      for (const doc of documents) {
        await APITestHelper.authenticatedRequest(
          '/api/knowledge-base/documents',
          {
            method: 'POST',
            body: JSON.stringify(doc)
          }
        )
      }

      // Mock OpenAI response for kb_only generation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Python Programming - KB Only',
                modules: [{
                  title: 'Python Fundamentals',
                  lessons: [{
                    title: 'Python Basics',
                    contentOutline: ['Variables', 'Data types', 'Indentation']
                  }]
                }]
              })
            }
          }]
        })
      })

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify({
            baseClassId: kbOnlyBaseClassId,
            title: 'Python Programming - KB Only',
            generationMode: 'kb_only',
            assessmentSettings: {
              includeAssessments: true,
              questionsPerLesson: 2
            }
          })
        }
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      expect(data.jobId).toBeTruthy()
    })

    test('should handle different academic levels', async () => {
      const academicLevels = ['high-school', 'college', 'graduate']
      
      for (const level of academicLevels) {
        // Mock appropriate OpenAI response for academic level
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  title: `Course for ${level}`,
                  modules: [{
                    title: 'Module 1',
                    lessons: [{
                      title: 'Lesson 1',
                      contentOutline: [`${level} appropriate content`]
                    }]
                  }]
                })
              }
            }]
          })
        })

        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/knowledge-base/generate-course',
          {
            method: 'POST',
            body: JSON.stringify({
              baseClassId,
              title: `Test Course - ${level}`,
              academicLevel: level,
              assessmentSettings: {
                includeAssessments: true,
                assessmentDifficulty: level === 'graduate' ? 'hard' : 'medium'
              }
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 200)
        expect(data.jobId).toBeTruthy()
      }
    })
  })

  describe('7. Performance and Error Handling', () => {
    test('should handle large course generation efficiently', async () => {
      const startTime = performance.now()

      // Mock complex course structure
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Large Course',
                modules: Array(5).fill(null).map((_, i) => ({
                  title: `Module ${i + 1}`,
                  lessons: Array(4).fill(null).map((_, j) => ({
                    title: `Lesson ${j + 1}`,
                    contentOutline: ['Section 1', 'Section 2', 'Section 3']
                  }))
                }))
              })
            }
          }]
        })
      })

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify({
            baseClassId,
            title: 'Large Course Test',
            estimatedDurationWeeks: 16,
            assessmentSettings: {
              includeAssessments: true,
              includeQuizzes: true,
              includeFinalExam: true,
              questionsPerLesson: 5,
              questionsPerQuiz: 10,
              questionsPerExam: 25
            }
          })
        }
      )

      const endTime = performance.now()
      const responseTime = endTime - startTime

      TestAssertions.assertAPIResponse(response, 200)
      expect(responseTime).toBeLessThan(10000) // Should respond within 10 seconds
    })

    test('should handle OpenAI API failures gracefully', async () => {
      // Mock OpenAI failure
      global.fetch = jest.fn().mockRejectedValue(new Error('OpenAI API Error'))

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify({
            baseClassId,
            title: 'Failed Generation Test',
            assessmentSettings: {
              includeAssessments: true
            }
          })
        }
      )

      // Should still create job even if generation fails
      TestAssertions.assertAPIResponse(response, 200)
      expect(data.jobId).toBeTruthy()

      // Check job status after some time
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const { response: statusResponse, data: statusData } = await APITestHelper.authenticatedRequest(
        `/api/knowledge-base/generation-status/${data.jobId}`
      )

      TestAssertions.assertAPIResponse(statusResponse, 200)
      expect(['failed', 'processing'].includes(statusData.data.job.status)).toBeTruthy()
    })

    test('should validate assessment settings', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify({
            baseClassId,
            title: 'Invalid Assessment Settings Test',
            assessmentSettings: {
              includeAssessments: true,
              questionsPerLesson: -5, // Invalid negative value
              questionsPerQuiz: 0, // Invalid zero value
              questionsPerExam: 1000 // Unreasonably large value
            }
          })
        }
      )

      // Should either reject invalid settings or normalize them
      if (response.status === 400) {
        TestAssertions.assertErrorResponse(data)
      } else {
        TestAssertions.assertAPIResponse(response, 200)
        // Verify settings were normalized in the job
      }
    })
  })

  describe('8. Analytics Integration for Generated Assessments', () => {
    test('should generate analytics for course assessments', async () => {
      // Get all assessments for the generated course
      const { data: assessments } = await testDb.query('assessments', {
        eq: ['base_class_id', baseClassId]
      })

      expect(assessments.length).toBeGreaterThan(0)

      // Test analytics for each assessment type
      for (const assessment of assessments) {
        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/analytics/assessments/${assessment.id}`
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.analytics).toHaveProperty('totalAttempts')
        expect(data.data.analytics).toHaveProperty('questionStatistics')
      }
    })

    test('should provide course-level analytics', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        `/api/teach/analytics?type=class-overview&baseClassId=${baseClassId}`
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      expect(data.data.analytics).toHaveProperty('totalAssessments')
      expect(data.data.analytics).toHaveProperty('assessmentTypes')
      expect(data.data.analytics.assessmentTypes).toEqual(
        expect.objectContaining({
          lesson_assessment: expect.any(Number),
          path_assessment: expect.any(Number),
          class_assessment: expect.any(Number)
        })
      )
    })
  })
})
