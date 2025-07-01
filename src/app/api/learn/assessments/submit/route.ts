import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Tables, TablesInsert, TablesUpdate } from '../../../../../../packages/types/db'
import { emitProgressUpdate } from '@/lib/utils/progressEvents'
import { ProgressService } from '@/lib/services/progressService'
import { HierarchicalProgressService } from '@/lib/services/hierarchical-progress-service'

type Assessment = Tables<'assessments'>
type AssessmentQuestion = Tables<'assessment_questions'>
type StudentAttempt = Tables<'student_attempts'>
type StudentResponse = Tables<'student_responses'>

interface SubmitAssessmentRequest {
  attemptId: string
  responses: Array<{
    question_id: string
    response_data: any
  }>
  timeSpent?: number
  isSubmission: boolean
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SubmitAssessmentRequest = await request.json()
    const { attemptId, responses, timeSpent, isSubmission } = body

    if (!attemptId || !responses || !Array.isArray(responses)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Get the attempt and verify it belongs to the user
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

    if (attempt.status === 'completed' || attempt.status === 'graded') {
      return NextResponse.json({ error: 'Assessment already submitted' }, { status: 400 })
    }

    // Get all questions for this assessment
    const { data: questions, error: questionsError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', attempt.assessment_id)
      .order('order_index')
      .returns<AssessmentQuestion[]>()

    if (questionsError || !questions) {
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
    }

    if (isSubmission) {
      // Process responses and calculate scores for final submission
      let totalPoints = 0
      let earnedPoints = 0
      let hasSubjectiveQuestions = false

      const responseInserts: TablesInsert<'student_responses'>[] = []

      for (const responseData of responses) {
        const question = questions.find((q: AssessmentQuestion) => q.id === responseData.question_id)
        if (!question) continue

        const questionPoints = question.points || 0
        totalPoints += questionPoints

        let isCorrect = false
        let pointsEarned = 0

        // Auto-grade objective questions
        if (question.question_type === 'multiple_choice') {
          const correctAnswer = (question.answer_key as any)?.correct_option
          const userAnswerLetter = responseData.response_data?.selected_option
          
          // Convert letter (A, B, C, D) back to option text
          const options = question.options || (question.answer_key as any)?.options || []
          let userAnswer = userAnswerLetter
          if (userAnswerLetter && userAnswerLetter.match(/^[A-Z]$/)) {
            const optionIndex = userAnswerLetter.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
            if (optionIndex >= 0 && optionIndex < options.length) {
              userAnswer = options[optionIndex]
            }
          }
          
          isCorrect = correctAnswer === userAnswer
          pointsEarned = isCorrect ? questionPoints : 0
        } else if (question.question_type === 'true_false') {
          const correctAnswer = (question.answer_key as any)?.correct_answer
          const userAnswer = responseData.response_data?.selected_answer
          isCorrect = correctAnswer === userAnswer
          pointsEarned = isCorrect ? questionPoints : 0
        } else if (question.question_type === 'matching') {
          const correctPairsArray = (question.answer_key as any)?.pairs || []
          const userPairs = responseData.response_data?.matches || {}
          
          // Convert pairs array to object for comparison
          const correctPairs: Record<string, string> = {}
          correctPairsArray.forEach((pair: any) => {
            correctPairs[pair.left] = pair.right
          })
          
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

        const responseInsert: TablesInsert<'student_responses'> = {
          attempt_id: attemptId,
          question_id: question.id,
          response_data: responseData.response_data,
          is_correct: question.question_type in ['multiple_choice', 'true_false', 'matching'] ? isCorrect : null,
          points_earned: pointsEarned,
          final_score: pointsEarned
        }

        responseInserts.push(responseInsert)
      }

      // Delete existing responses for this attempt
      await supabase
        .from('student_responses')
        .delete()
        .eq('attempt_id', attemptId)

      // Insert new responses
      const { error: responsesError } = await supabase
        .from('student_responses')
        .insert(responseInserts)

      if (responsesError) {
        return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 })
      }

      // Calculate final scores and update attempt
      const percentageScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0
      const passingScore = attempt.assessment.passing_score_percentage || 70
      const passed = percentageScore >= passingScore

      const attemptUpdate: TablesUpdate<'student_attempts'> = {
        status: hasSubjectiveQuestions ? 'grading' : 'completed',
        submitted_at: new Date().toISOString(),
        time_spent_minutes: timeSpent || 0,
        total_points: totalPoints,
        earned_points: earnedPoints,
        percentage_score: percentageScore,
        passed: hasSubjectiveQuestions ? null : passed, // Don't mark as passed/failed until AI grading is complete
        ai_grading_status: hasSubjectiveQuestions ? 'pending' : 'completed'
      }

      const { error: updateError } = await supabase
        .from('student_attempts')
        .update(attemptUpdate)
        .eq('id', attemptId)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update attempt scores' }, { status: 500 })
      }

      // Update progress table for assessment completion using ProgressService
      try {
        const progressStatus = hasSubjectiveQuestions ? 'in_progress' : (passed ? 'passed' : 'failed');
        const progressPercentage = hasSubjectiveQuestions ? 50 : 100; // 50% if waiting for AI grading, 100% if completed
        
        // Use ProgressService to update assessment progress, which will also update class instance progress
        const hierarchicalService = new HierarchicalProgressService(true);
        const progressService = new ProgressService(user.id, supabase, hierarchicalService);
        await progressService.updateAssessmentProgress(attempt.assessment_id, {
          status: progressStatus,
          progressPercentage: progressPercentage,
          lastPosition: null
        });

        console.log(`Updated assessment progress: ${attempt.assessment_id} -> ${progressPercentage}%`);
      } catch (progressUpdateError) {
        console.error('Error updating assessment progress:', progressUpdateError);
        // Don't fail the request if progress update fails
      }

      return NextResponse.json({
        success: true,
        attemptId: attemptId,
        totalPoints,
        earnedPoints,
        percentageScore,
        passed: hasSubjectiveQuestions ? null : passed,
        needsAiGrading: hasSubjectiveQuestions,
        message: hasSubjectiveQuestions 
          ? 'Submission successful. AI grading in progress for subjective questions.'
          : 'Assessment completed successfully!'
      })

    } else {
      // Just save responses without final scoring (auto-save functionality)
      const responseInserts: TablesInsert<'student_responses'>[] = responses.map(responseData => ({
        attempt_id: attemptId,
        question_id: responseData.question_id,
        response_data: responseData.response_data,
        is_correct: null, // Don't score until final submission
        points_earned: 0,
        final_score: 0
      }))

      // Delete existing responses for this attempt
      await supabase
        .from('student_responses')
        .delete()
        .eq('attempt_id', attemptId)

      // Insert new responses
      const { error: responsesError } = await supabase
        .from('student_responses')
        .insert(responseInserts)

      if (responsesError) {
        return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 })
      }

      // Update the time spent
      if (timeSpent !== undefined) {
        await supabase
          .from('student_attempts')
          .update({ time_spent_minutes: timeSpent })
          .eq('id', attemptId)
      }

      return NextResponse.json({ success: true, message: 'Responses saved' })
    }

  } catch (error) {
    console.error('Error submitting assessment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 