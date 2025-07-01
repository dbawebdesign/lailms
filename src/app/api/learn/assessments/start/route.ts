import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Tables, TablesInsert } from '../../../../../../packages/types/db'

type Assessment = Tables<'assessments'>
type AssessmentQuestion = Tables<'assessment_questions'>
type StudentAttempt = Tables<'student_attempts'>

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assessmentId } = await request.json()

    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment ID is required' }, { status: 400 })
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
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('student_id', user.id)
      .order('attempt_number', { ascending: false })
      .returns<StudentAttempt[]>()

    if (attemptsError) {
      return NextResponse.json({ error: 'Failed to check existing attempts' }, { status: 500 })
    }

    // Check if there's already an in-progress attempt
    const inProgressAttempt = existingAttempts?.find(attempt => attempt.status === 'in_progress')
    if (inProgressAttempt) {
      // Return the existing in-progress attempt instead of creating a new one
      const { data: questions, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index')
        .returns<AssessmentQuestion[]>()

      if (questionsError || !questions) {
        return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
      }

      // Remove answer keys from questions before sending to client
      const sanitizedQuestions = questions.map(question => ({
        ...question,
        answer_key: undefined
      }))

      return NextResponse.json({
        assessment,
        questions: sanitizedQuestions,
        attempt: inProgressAttempt
      })
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

    // Create a new attempt record with 'in_progress' status
    const attemptData: TablesInsert<'student_attempts'> = {
      assessment_id: assessmentId,
      student_id: user.id,
      attempt_number: currentAttemptNumber,
      status: 'in_progress',
      started_at: new Date().toISOString(),
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

    // Remove answer keys from questions before sending to client
    const sanitizedQuestions = questions.map(question => ({
      ...question,
      answer_key: undefined // Don't send correct answers to the client
    }))

    return NextResponse.json({
      assessment,
      questions: sanitizedQuestions,
      attempt: newAttempt
    })

  } catch (error) {
    console.error('Error starting assessment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 