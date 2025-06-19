/**
 * End-to-End Assessment Lifecycle Integration Tests
 * 
 * This test suite validates the complete assessment workflow:
 * 1. Teacher creates assessment with question generation
 * 2. Student takes assessment with progress tracking
 * 3. System processes results and generates analytics
 * 4. Teacher reviews results and provides feedback
 */

import { 
  TestDatabase, 
  APITestHelper, 
  TestAssertions, 
  setupTestEnvironment, 
  teardownTestEnvironment 
} from '../utils/testHelpers'
import { mockOpenAIResponse } from '../fixtures/testData'

describe('Assessment Lifecycle Integration Tests', () => {
  let testDb: TestDatabase
  
  beforeAll(async () => {
    testDb = await setupTestEnvironment()
  })

  afterAll(async () => {
    await teardownTestEnvironment(testDb)
  })

  describe('1. Assessment Creation Workflow', () => {
    test('should create assessment with AI-generated questions', async () => {
      // Mock OpenAI response
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenAIResponse
      })

      // Step 1: Generate questions from lesson content
      const { response: generateResponse, data: generateData } = await APITestHelper.authenticatedRequest(
        '/api/teach/questions/generate-from-content',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Introduction to algorithms and data structures',
            contentType: 'lesson',
            sourceId: 'lesson-1',
            baseClassId: 'test-base-class-1',
            questionCount: 5,
            questionTypes: ['multiple_choice', 'short_answer'],
            difficultyLevels: ['easy', 'medium']
          })
        }
      )

      TestAssertions.assertAPIResponse(generateResponse, 200)
      TestAssertions.assertSuccessResponse(generateData)
      expect(generateData.data.questions).toHaveLength(2) // Based on mock response

      // Step 2: Create assessment using generated questions
      const { response: createResponse, data: createData } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Integration Test Assessment',
            description: 'Test assessment for integration testing',
            baseClassId: 'test-base-class-1',
            assessmentType: 'quiz',
            timeLimitMinutes: 30,
            passingScore: 70,
            questionIds: generateData.data.questions.map((q: any) => q.id),
            isPublished: true
          })
        }
      )

      TestAssertions.assertAPIResponse(createResponse, 201)
      TestAssertions.assertSuccessResponse(createData)
      TestAssertions.assertValidAssessment(createData.data.assessment)

      // Verify assessment was created in database
      const { data: dbAssessment } = await testDb.query('assessments', {
        eq: ['id', createData.data.assessment.id]
      })
      expect(dbAssessment).toBeTruthy()
    })

    test('should handle assessment creation with manual question selection', async () => {
      // Get existing questions from test data
      const { data: questions } = await testDb.query('questions')
      expect(questions.length).toBeGreaterThan(0)

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Manual Question Assessment',
            description: 'Assessment with manually selected questions',
            baseClassId: 'test-base-class-1',
            assessmentType: 'exam',
            timeLimitMinutes: 60,
            passingScore: 75,
            questionIds: questions.slice(0, 3).map((q: any) => q.id),
            isPublished: true
          })
        }
      )

      TestAssertions.assertAPIResponse(response, 201)
      TestAssertions.assertValidAssessment(data.data.assessment)
    })
  })

  describe('2. Student Assessment Taking Workflow', () => {
    let assessmentId: string
    let attemptId: string

    beforeAll(async () => {
      // Create a test assessment
      const { data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Student Test Assessment',
            baseClassId: 'test-base-class-1',
            assessmentType: 'quiz',
            timeLimitMinutes: 30,
            questionIds: ['test-question-1', 'test-question-2'],
            isPublished: true
          })
        }
      )
      assessmentId = data.data.assessment.id
    })

    test('should start assessment attempt for student', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            assessmentId,
            userId: 'test-student-1'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(response, 201)
      TestAssertions.assertSuccessResponse(data)
      TestAssertions.assertValidAttempt(data.data.attempt)
      
      attemptId = data.data.attempt.id
      expect(data.data.questions).toHaveLength(2)
    })

    test('should submit answers and track progress', async () => {
      // Submit first answer
      const { response: answer1Response, data: answer1Data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'PUT',
          body: JSON.stringify({
            attemptId,
            questionId: 'test-question-1',
            answerText: 'O(log n)',
            questionIndex: 0
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(answer1Response, 200)
      TestAssertions.assertSuccessResponse(answer1Data)

      // Check progress
      const { response: progressResponse, data: progressData } = await APITestHelper.authenticatedRequest(
        `/api/teach/assessments/attempt?attemptId=${attemptId}`,
        { method: 'GET' },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(progressResponse, 200)
      expect(progressData.data.progress.answered).toBe(1)
      expect(progressData.data.progress.total).toBe(2)

      // Submit second answer
      const { response: answer2Response } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'PUT',
          body: JSON.stringify({
            attemptId,
            questionId: 'test-question-2',
            answerText: 'Stack is LIFO, Queue is FIFO',
            questionIndex: 1
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(answer2Response, 200)
    })

    test('should complete assessment and calculate score', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
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

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      
      expect(data.data.result.status).toBe('completed')
      expect(data.data.result.score).toBeGreaterThan(0)
      expect(data.data.result.totalPoints).toBeGreaterThan(0)
      expect(data.data.result.percentage).toBeGreaterThanOrEqual(0)
      expect(data.data.result.percentage).toBeLessThanOrEqual(100)
    })
  })

  describe('3. Analytics and Results Processing', () => {
    test('should generate student performance analytics', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/analytics?type=student-results&userId=test-student-1&baseClassId=test-base-class-1',
        { method: 'GET' }
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      
      expect(data.data.analytics).toHaveProperty('totalAttempts')
      expect(data.data.analytics).toHaveProperty('averageScore')
      expect(data.data.analytics).toHaveProperty('completionRate')
      expect(data.data.analytics.attempts).toBeInstanceOf(Array)
    })

    test('should generate assessment-level analytics', async () => {
      // Get an assessment ID from test data
      const { data: assessments } = await testDb.query('assessments')
      const assessmentId = assessments[0]?.id

      if (assessmentId) {
        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/analytics/assessments/${assessmentId}`,
          { method: 'GET' }
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        
        expect(data.data.analytics).toHaveProperty('totalAttempts')
        expect(data.data.analytics).toHaveProperty('averageScore')
        expect(data.data.analytics).toHaveProperty('questionStatistics')
        expect(data.data.analytics.questionStatistics).toBeInstanceOf(Array)
      }
    })

    test('should generate comparative analytics', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/analytics/compare',
        {
          method: 'POST',
          body: JSON.stringify({
            userIds: ['test-student-1', 'test-student-2'],
            baseClassId: 'test-base-class-1',
            comparisonType: 'performance'
          })
        }
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      
      expect(data.data.comparison).toHaveProperty('users')
      expect(data.data.comparison.users).toBeInstanceOf(Array)
      expect(data.data.comparison).toHaveProperty('summary')
    })
  })

  describe('4. Teacher Review and Management', () => {
    test('should retrieve assessment results for review', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments?baseClassId=test-base-class-1&includeResults=true',
        { method: 'GET' }
      )

      TestAssertions.assertAPIResponse(response, 200)
      TestAssertions.assertSuccessResponse(data)
      
      expect(data.data.assessments).toBeInstanceOf(Array)
      data.data.assessments.forEach((assessment: any) => {
        TestAssertions.assertValidAssessment(assessment)
        if (assessment.results) {
          expect(assessment.results).toBeInstanceOf(Array)
        }
      })
    })

    test('should update assessment configuration', async () => {
      // Get an assessment ID
      const { data: assessments } = await testDb.query('assessments')
      const assessmentId = assessments[0]?.id

      if (assessmentId) {
        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/assessments/${assessmentId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              title: 'Updated Assessment Title',
              passingScore: 80,
              timeLimitMinutes: 45
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.assessment.title).toBe('Updated Assessment Title')
        expect(data.data.assessment.passing_score).toBe(80)
      }
    })

    test('should manage question bank', async () => {
      // Create new question
      const { response: createResponse, data: createData } = await APITestHelper.authenticatedRequest(
        '/api/teach/questions',
        {
          method: 'POST',
          body: JSON.stringify({
            questionText: 'What is recursion?',
            questionType: 'short_answer',
            difficultyLevel: 'medium',
            correctAnswer: 'A function that calls itself',
            points: 10,
            baseClassId: 'test-base-class-1',
            tags: ['recursion', 'functions']
          })
        }
      )

      TestAssertions.assertAPIResponse(createResponse, 201)
      TestAssertions.assertValidQuestion(createData.data.question)

      // Update question
      const questionId = createData.data.question.id
      const { response: updateResponse, data: updateData } = await APITestHelper.authenticatedRequest(
        `/api/teach/questions/${questionId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            questionText: 'What is recursion in programming?',
            points: 15
          })
        }
      )

      TestAssertions.assertAPIResponse(updateResponse, 200)
      expect(updateData.data.question.question_text).toBe('What is recursion in programming?')
      expect(updateData.data.question.points).toBe(15)

      // Delete question
      const { response: deleteResponse } = await APITestHelper.authenticatedRequest(
        `/api/teach/questions/${questionId}`,
        { method: 'DELETE' }
      )

      TestAssertions.assertAPIResponse(deleteResponse, 200)
    })
  })

  describe('5. Course Generation Integration', () => {
    test('should generate assessment during course creation', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/knowledge-base/generate-course',
        {
          method: 'POST',
          body: JSON.stringify({
            baseClassId: 'test-base-class-1',
            title: 'Advanced Computer Science',
            description: 'Advanced topics in computer science',
            generateAssessments: true,
            assessmentConfig: {
              questionsPerLesson: 3,
              questionTypes: ['multiple_choice', 'short_answer'],
              difficultyDistribution: { easy: 40, medium: 40, hard: 20 }
            }
          })
        }
      )

      // Course generation is async, so we check for job creation
      TestAssertions.assertAPIResponse(response, 202)
      expect(data.data).toHaveProperty('jobId')
      
      // In a real test, we would poll the generation status endpoint
      // For this integration test, we'll verify the job was created
      expect(data.data.jobId).toBeTruthy()
    })
  })

  describe('6. Error Handling and Edge Cases', () => {
    test('should handle invalid assessment creation', async () => {
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: '', // Invalid: empty title
            baseClassId: 'invalid-id', // Invalid: non-existent base class
            questionIds: [] // Invalid: no questions
          })
        }
      )

      TestAssertions.assertAPIResponse(response, 400)
      TestAssertions.assertErrorResponse(data)
    })

    test('should handle unauthorized access attempts', async () => {
      const { response, data } = await APITestHelper.makeRequest(
        '/api/teach/assessments',
        { method: 'GET' }
        // No authentication headers
      )

      TestAssertions.assertAPIResponse(response, 401)
      TestAssertions.assertErrorResponse(data, 'Unauthorized')
    })

    test('should handle assessment attempt on unpublished assessment', async () => {
      // Create unpublished assessment
      const { data: assessmentData } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Unpublished Assessment',
            baseClassId: 'test-base-class-1',
            questionIds: ['test-question-1'],
            isPublished: false
          })
        }
      )

      // Try to start attempt as student
      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments/attempt',
        {
          method: 'POST',
          body: JSON.stringify({
            assessmentId: assessmentData.data.assessment.id,
            userId: 'test-student-1'
          })
        },
        'test-student-1'
      )

      TestAssertions.assertAPIResponse(response, 403)
      TestAssertions.assertErrorResponse(data, 'not published')
    })

    test('should handle OpenAI API failures gracefully', async () => {
      // Mock OpenAI failure
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('OpenAI API Error'))

      const { response, data } = await APITestHelper.authenticatedRequest(
        '/api/teach/questions/generate-from-content',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Test content',
            contentType: 'lesson',
            baseClassId: 'test-base-class-1',
            questionCount: 5
          })
        }
      )

      TestAssertions.assertAPIResponse(response, 500)
      TestAssertions.assertErrorResponse(data, 'generation failed')
    })
  })
}) 