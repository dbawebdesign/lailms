/**
 * API Endpoints Integration Tests
 * 
 * This test suite validates all assessment-related API endpoints:
 * - Authentication and authorization
 * - Request/response formats
 * - Error handling
 * - Data validation
 * - Performance characteristics
 */

import { 
  TestDatabase, 
  APITestHelper, 
  TestAssertions, 
  PerformanceTestHelper,
  setupTestEnvironment, 
  teardownTestEnvironment 
} from '../utils/testHelpers'

describe('API Endpoints Integration Tests', () => {
  let testDb: TestDatabase
  
  beforeAll(async () => {
    testDb = await setupTestEnvironment()
  })

  afterAll(async () => {
    await teardownTestEnvironment(testDb)
  })

  describe('Assessment Management APIs', () => {
    describe('GET /api/teach/assessments', () => {
      test('should return assessments for authenticated teacher', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments?baseClassId=test-base-class-1'
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.assessments).toBeInstanceOf(Array)
      })

      test('should filter assessments by status', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments?baseClassId=test-base-class-1&status=published'
        )

        TestAssertions.assertAPIResponse(response, 200)
        data.data.assessments.forEach((assessment: any) => {
          expect(assessment.is_published).toBe(true)
        })
      })

      test('should include results when requested', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments?baseClassId=test-base-class-1&includeResults=true'
        )

        TestAssertions.assertAPIResponse(response, 200)
        if (data.data.assessments.length > 0) {
          expect(data.data.assessments[0]).toHaveProperty('results')
        }
      })

      test('should handle unauthorized access', async () => {
        const { response, data } = await APITestHelper.makeRequest('/api/teach/assessments')
        
        TestAssertions.assertAPIResponse(response, 401)
        TestAssertions.assertErrorResponse(data)
      })
    })

    describe('POST /api/teach/assessments', () => {
      test('should create assessment with valid data', async () => {
        const assessmentData = {
          title: 'API Test Assessment',
          description: 'Test assessment created via API',
          baseClassId: 'test-base-class-1',
          assessmentType: 'quiz',
          timeLimitMinutes: 30,
          passingScore: 70,
          questionIds: ['test-question-1', 'test-question-2'],
          isPublished: true
        }

        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments',
          {
            method: 'POST',
            body: JSON.stringify(assessmentData)
          }
        )

        TestAssertions.assertAPIResponse(response, 201)
        TestAssertions.assertSuccessResponse(data)
        TestAssertions.assertValidAssessment(data.data.assessment)
        expect(data.data.assessment.title).toBe(assessmentData.title)
      })

      test('should validate required fields', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments',
          {
            method: 'POST',
            body: JSON.stringify({
              description: 'Missing title and other required fields'
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 400)
        TestAssertions.assertErrorResponse(data)
      })

      test('should validate question IDs exist', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments',
          {
            method: 'POST',
            body: JSON.stringify({
              title: 'Test Assessment',
              baseClassId: 'test-base-class-1',
              questionIds: ['non-existent-question-id']
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 400)
        TestAssertions.assertErrorResponse(data, 'question')
      })
    })

    describe('PUT /api/teach/assessments/[id]', () => {
      let assessmentId: string

      beforeAll(async () => {
        const { data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments',
          {
            method: 'POST',
            body: JSON.stringify({
              title: 'Test Assessment for Update',
              baseClassId: 'test-base-class-1',
              questionIds: ['test-question-1']
            })
          }
        )
        assessmentId = data.data.assessment.id
      })

      test('should update assessment fields', async () => {
        const updates = {
          title: 'Updated Assessment Title',
          passingScore: 85,
          timeLimitMinutes: 45
        }

        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/assessments/${assessmentId}`,
          {
            method: 'PUT',
            body: JSON.stringify(updates)
          }
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.assessment.title).toBe(updates.title)
        expect(data.data.assessment.passing_score).toBe(updates.passingScore)
      })

      test('should handle non-existent assessment', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments/non-existent-id',
          {
            method: 'PUT',
            body: JSON.stringify({ title: 'Updated Title' })
          }
        )

        TestAssertions.assertAPIResponse(response, 404)
        TestAssertions.assertErrorResponse(data)
      })
    })

    describe('DELETE /api/teach/assessments/[id]', () => {
      test('should delete assessment', async () => {
        // Create assessment to delete
        const { data: createData } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments',
          {
            method: 'POST',
            body: JSON.stringify({
              title: 'Assessment to Delete',
              baseClassId: 'test-base-class-1',
              questionIds: ['test-question-1']
            })
          }
        )

        const assessmentId = createData.data.assessment.id

        // Delete assessment
        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/assessments/${assessmentId}`,
          { method: 'DELETE' }
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)

        // Verify deletion
        const { response: getResponse } = await APITestHelper.authenticatedRequest(
          `/api/teach/assessments/${assessmentId}`
        )
        expect(getResponse.status).toBe(404)
      })
    })
  })

  describe('Question Management APIs', () => {
    describe('GET /api/teach/questions', () => {
      test('should return questions for base class', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions?baseClassId=test-base-class-1'
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.questions).toBeInstanceOf(Array)
      })

      test('should filter by question type', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions?baseClassId=test-base-class-1&type=multiple_choice'
        )

        TestAssertions.assertAPIResponse(response, 200)
        data.data.questions.forEach((question: any) => {
          expect(question.question_type).toBe('multiple_choice')
        })
      })

      test('should filter by difficulty level', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions?baseClassId=test-base-class-1&difficulty=medium'
        )

        TestAssertions.assertAPIResponse(response, 200)
        data.data.questions.forEach((question: any) => {
          expect(question.difficulty_level).toBe('medium')
        })
      })

      test('should search by tags', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions?baseClassId=test-base-class-1&tags=algorithms'
        )

        TestAssertions.assertAPIResponse(response, 200)
        data.data.questions.forEach((question: any) => {
          expect(question.tags).toContain('algorithms')
        })
      })
    })

    describe('POST /api/teach/questions', () => {
      test('should create question with valid data', async () => {
        const questionData = {
          questionText: 'What is Big O notation?',
          questionType: 'short_answer',
          difficultyLevel: 'medium',
          correctAnswer: 'A notation to describe algorithm complexity',
          sampleResponse: 'Big O notation describes the upper bound of algorithm complexity',
          points: 10,
          baseClassId: 'test-base-class-1',
          tags: ['algorithms', 'complexity']
        }

        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions',
          {
            method: 'POST',
            body: JSON.stringify(questionData)
          }
        )

        TestAssertions.assertAPIResponse(response, 201)
        TestAssertions.assertSuccessResponse(data)
        TestAssertions.assertValidQuestion(data.data.question)
        expect(data.data.question.question_text).toBe(questionData.questionText)
      })

      test('should validate multiple choice options', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions',
          {
            method: 'POST',
            body: JSON.stringify({
              questionText: 'Multiple choice without options',
              questionType: 'multiple_choice',
              correctAnswer: 'Option A',
              baseClassId: 'test-base-class-1'
              // Missing options array
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 400)
        TestAssertions.assertErrorResponse(data, 'options')
      })
    })

    describe('POST /api/teach/questions/generate-from-content', () => {
      test('should generate questions from content', async () => {
        // Mock OpenAI response
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify([
                  {
                    question_text: 'Generated question',
                    question_type: 'multiple_choice',
                    difficulty_level: 'easy',
                    correct_answer: 'Correct answer',
                    options: ['Correct answer', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
                    points: 5,
                    tags: ['generated']
                  }
                ])
              }
            }]
          })
        })

        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions/generate-from-content',
          {
            method: 'POST',
            body: JSON.stringify({
              content: 'Test content for question generation',
              contentType: 'lesson',
              sourceId: 'lesson-1',
              baseClassId: 'test-base-class-1',
              questionCount: 1,
              questionTypes: ['multiple_choice']
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.questions).toHaveLength(1)
        TestAssertions.assertValidQuestion(data.data.questions[0])
      })

      test('should handle OpenAI API errors', async () => {
        // Mock OpenAI failure
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('API Error'))

        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/questions/generate-from-content',
          {
            method: 'POST',
            body: JSON.stringify({
              content: 'Test content',
              baseClassId: 'test-base-class-1'
            })
          }
        )

        TestAssertions.assertAPIResponse(response, 500)
        TestAssertions.assertErrorResponse(data)
      })
    })
  })

  describe('Assessment Taking APIs', () => {
    let assessmentId: string

    beforeAll(async () => {
      const { data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Taking Assessment',
            baseClassId: 'test-base-class-1',
            questionIds: ['test-question-1', 'test-question-2'],
            isPublished: true
          })
        }
      )
      assessmentId = data.data.assessment.id
    })

    describe('POST /api/teach/assessments/attempt', () => {
      test('should start assessment attempt', async () => {
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
        expect(data.data.questions).toBeInstanceOf(Array)
      })

      test('should prevent multiple active attempts', async () => {
        // Start first attempt
        await APITestHelper.authenticatedRequest(
          '/api/teach/assessments/attempt',
          {
            method: 'POST',
            body: JSON.stringify({
              assessmentId,
              userId: 'test-student-2'
            })
          },
          'test-student-2'
        )

        // Try to start second attempt
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments/attempt',
          {
            method: 'POST',
            body: JSON.stringify({
              assessmentId,
              userId: 'test-student-2'
            })
          },
          'test-student-2'
        )

        TestAssertions.assertAPIResponse(response, 409)
        TestAssertions.assertErrorResponse(data, 'active attempt')
      })
    })

    describe('PUT /api/teach/assessments/attempt', () => {
      let attemptId: string

      beforeAll(async () => {
        const { data } = await APITestHelper.authenticatedRequest(
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
        attemptId = data.data.attempt.id
      })

      test('should submit answer', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
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

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.answer).toHaveProperty('id')
      })

      test('should validate answer format', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/assessments/attempt',
          {
            method: 'PUT',
            body: JSON.stringify({
              attemptId,
              questionId: 'invalid-question-id',
              answerText: ''
            })
          },
          'test-student-1'
        )

        TestAssertions.assertAPIResponse(response, 400)
        TestAssertions.assertErrorResponse(data)
      })
    })
  })

  describe('Analytics APIs', () => {
    let analyticsAssessmentId: string

    beforeAll(async () => {
      // Create a test assessment for analytics testing
      const { data } = await APITestHelper.authenticatedRequest(
        '/api/teach/assessments',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Test Analytics Assessment',
            baseClassId: 'test-base-class-1',
            questionIds: ['test-question-1', 'test-question-2'],
            isPublished: true
          })
        }
      )
      analyticsAssessmentId = data.data.assessment.id
    })

    describe('GET /api/teach/analytics', () => {
      test('should return student results analytics', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/analytics?type=student-results&userId=test-student-1&baseClassId=test-base-class-1'
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.analytics).toHaveProperty('totalAttempts')
        expect(data.data.analytics).toHaveProperty('averageScore')
      })

      test('should return user progress analytics', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/analytics?type=user-progress&userId=test-student-1&baseClassId=test-base-class-1'
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.analytics).toHaveProperty('completedAssessments')
        expect(data.data.analytics).toHaveProperty('progressPercentage')
      })

      test('should validate required parameters', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          '/api/teach/analytics?type=student-results'
          // Missing required userId parameter
        )

        TestAssertions.assertAPIResponse(response, 400)
        TestAssertions.assertErrorResponse(data, 'userId')
      })
    })

    describe('GET /api/teach/analytics/assessments/[id]', () => {
      test('should return assessment analytics', async () => {
        const { response, data } = await APITestHelper.authenticatedRequest(
          `/api/teach/analytics/assessments/${analyticsAssessmentId}`
        )

        TestAssertions.assertAPIResponse(response, 200)
        TestAssertions.assertSuccessResponse(data)
        expect(data.data.analytics).toHaveProperty('totalAttempts')
        expect(data.data.analytics).toHaveProperty('questionStatistics')
      })
    })

    describe('POST /api/teach/analytics/compare', () => {
      test('should compare user performance', async () => {
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
        expect(data.data.comparison).toHaveProperty('summary')
      })
    })
  })

  describe('Performance Tests', () => {
    test('should handle concurrent question generation requests', async () => {
      // Mock successful OpenAI responses
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify([{
                question_text: 'Test question',
                question_type: 'multiple_choice',
                difficulty_level: 'easy',
                correct_answer: 'A',
                options: ['A', 'B', 'C', 'D'],
                points: 5,
                tags: ['test']
              }])
            }
          }]
        })
      })

      const testFn = () => APITestHelper.authenticatedRequest(
        '/api/teach/questions/generate-from-content',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Test content',
            baseClassId: 'test-base-class-1',
            questionCount: 1
          })
        }
      )

      const { averageTime, maxTime } = await PerformanceTestHelper.runConcurrentTests(
        testFn,
        5, // 5 concurrent requests
        10  // 10 iterations
      )

      expect(averageTime).toBeLessThan(5000) // Should average under 5 seconds
      expect(maxTime).toBeLessThan(10000)    // Max should be under 10 seconds
    }, 60000) // 60 second timeout

    test('should handle high-volume assessment retrieval', async () => {
      const testFn = () => APITestHelper.authenticatedRequest(
        '/api/teach/assessments?baseClassId=test-base-class-1'
      )

      const { averageTime } = await PerformanceTestHelper.runConcurrentTests(
        testFn,
        10, // 10 concurrent requests
        50  // 50 iterations
      )

      expect(averageTime).toBeLessThan(1000) // Should average under 1 second
    }, 30000)
  })
}) 