import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase/server'
import { Database, Tables, TablesInsert, TablesUpdate } from '../../../../../../packages/types/db'

// Types for V2 schema
type Assessment = Tables<'assessments'>
type AssessmentQuestion = Tables<'assessment_questions'>
type StudentAttempt = Tables<'student_attempts'>
type StudentResponse = Tables<'student_responses'>

interface SubmitAttemptRequest {
  assessmentId: string
  responses: Array<{
    questionId: string
    response: {
      selected_option?: string
      selected_answer?: boolean
      text_answer?: string
      selected_options?: string[]
      pairs?: Record<string, string>
    }
  }>
}

interface QuestionResponse {
  questionId: string
  response: {
    selected_option?: string
    selected_answer?: boolean
    text_answer?: string
    selected_options?: string[]
    pairs?: Record<string, string>
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SubmitAttemptRequest = await request.json()
    const { assessmentId, responses } = body

    if (!assessmentId || !responses || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Get assessment details
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single<Assessment>()

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    // Check existing attempts
    const { data: existingAttempts, error: attemptsError } = await supabase
      .from('student_attempts')
      .select('attempt_number')
      .eq('assessment_id', assessmentId)
      .eq('student_id', user.id)
      .order('attempt_number', { ascending: false })
      .returns<Pick<StudentAttempt, 'attempt_number'>[]>()

    if (attemptsError) {
      return NextResponse.json({ error: 'Failed to check existing attempts' }, { status: 500 })
    }

    // Check attempt limits
    const currentAttemptNumber = (existingAttempts?.[0]?.attempt_number || 0) + 1
    if (assessment.max_attempts && currentAttemptNumber > assessment.max_attempts) {
      return NextResponse.json({ error: 'Maximum attempts exceeded' }, { status: 400 })
    }

    // Get all questions for this assessment
    const { data: questions, error: questionsError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('order_index')
      .returns<AssessmentQuestion[]>()

    if (questionsError || !questions) {
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
    }

    // Create the attempt record
    const attemptData: TablesInsert<'student_attempts'> = {
      assessment_id: assessmentId,
      student_id: user.id,
      attempt_number: currentAttemptNumber,
      status: 'submitted',
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      ai_grading_status: 'pending'
    }

    const { data: newAttempt, error: attemptError } = await supabase
      .from('student_attempts')
      .insert(attemptData)
      .select()
      .single<StudentAttempt>()

    if (attemptError || !newAttempt) {
      return NextResponse.json({ error: 'Failed to create attempt' }, { status: 500 })
    }

    // Process responses and calculate scores
    let totalPoints = 0
    let earnedPoints = 0
    let hasSubjectiveQuestions = false

    const responseInserts: TablesInsert<'student_responses'>[] = []

    for (const questionResponse of responses) {
      const question = questions.find((q: AssessmentQuestion) => q.id === questionResponse.questionId)
      if (!question) continue

      const questionPoints = question.points || 0
      totalPoints += questionPoints

      let isCorrect = false
      let pointsEarned = 0

      // Auto-grade objective questions
      if (question.question_type === 'multiple_choice') {
        const correctAnswer = (question.answer_key as any)?.correct_option
        const userAnswer = questionResponse.response.selected_option
        isCorrect = correctAnswer === userAnswer
        pointsEarned = isCorrect ? questionPoints : 0
      } else if (question.question_type === 'true_false') {
        const correctAnswer = (question.answer_key as any)?.correct_answer
        const userAnswer = questionResponse.response.selected_answer
        isCorrect = correctAnswer === userAnswer
        pointsEarned = isCorrect ? questionPoints : 0
      } else if (question.question_type === 'matching') {
        const correctPairs = (question.answer_key as any)?.correct_pairs || {}
        const userPairs = questionResponse.response.pairs || {}
        
        let correctMatches = 0
        const totalMatches = Object.keys(correctPairs).length
        
        for (const [key, value] of Object.entries(correctPairs)) {
          if (userPairs[key] === value) {
            correctMatches++
          }
        }
        
        isCorrect = correctMatches === totalMatches
        pointsEarned = (correctMatches / totalMatches) * questionPoints
      } else {
        // Subjective questions need AI grading
        hasSubjectiveQuestions = true
        pointsEarned = 0 // Will be graded later
      }

      earnedPoints += pointsEarned

      const responseData: TablesInsert<'student_responses'> = {
        attempt_id: newAttempt.id,
        question_id: question.id,
        response_data: questionResponse.response,
        is_correct: question.question_type in ['multiple_choice', 'true_false', 'matching'] ? isCorrect : null,
        points_earned: pointsEarned,
        final_score: pointsEarned
      }

      responseInserts.push(responseData)
    }

    // Insert all responses
    const { error: responsesError } = await supabase
      .from('student_responses')
      .insert(responseInserts)

    if (responsesError) {
      return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 })
    }

    // Calculate final scores and update attempt
    const percentageScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
    const passingScore = assessment.passing_score_percentage || 70
    const passed = percentageScore >= passingScore

    const attemptUpdate: TablesUpdate<'student_attempts'> = {
      total_points: totalPoints,
      earned_points: earnedPoints,
      percentage_score: percentageScore,
      passed: hasSubjectiveQuestions ? null : passed, // Don't mark as passed/failed until AI grading is complete
      ai_grading_status: hasSubjectiveQuestions ? 'pending' : 'completed'
    }

    const { error: updateError } = await supabase
      .from('student_attempts')
      .update(attemptUpdate)
      .eq('id', newAttempt.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update attempt scores' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      attemptId: newAttempt.id,
      totalPoints,
      earnedPoints,
      percentageScore,
      passed: hasSubjectiveQuestions ? null : passed,
      needsAiGrading: hasSubjectiveQuestions,
      message: hasSubjectiveQuestions 
        ? 'Submission successful. AI grading in progress for subjective questions.'
        : 'Assessment completed successfully!'
    })

  } catch (error) {
    console.error('Error submitting assessment attempt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/teach/assessments/attempt - Get attempt details
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get('attemptId')

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 })
    }

    // Fetch attempt details with assessment info
    const { data: attempt, error: attemptError } = await supabase
      .from('student_attempts')
      .select(`
        *,
        assessment:assessments(*)
      `)
      .eq('id', attemptId)
      .eq('student_id', user.id)
      .single<StudentAttempt & { assessment: Assessment }>()

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    // Fetch associated responses
    const { data: responses, error: responsesError } = await supabase
      .from('student_responses')
      .select(`
        *,
        question:assessment_questions(*)
      `)
      .eq('attempt_id', attemptId)
      .order('created_at')
      .returns<(StudentResponse & { question: AssessmentQuestion })[]>()

    if (responsesError) {
      // It's okay if there are no responses yet, don't throw error
      console.error('Error fetching responses:', responsesError)
      return NextResponse.json({ error: 'Failed to fetch attempt responses' }, { status: 500 })
    }

    return NextResponse.json({
      attempt,
      responses: responses || []
    })

  } catch (error) {
    console.error('Error in GET /api/teach/assessments/attempt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
 