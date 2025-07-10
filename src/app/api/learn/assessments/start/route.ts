import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Tables, TablesInsert } from '../../../../../../packages/types/db'

type Assessment = Tables<'assessments'>
type AssessmentQuestion = Tables<'assessment_questions'>
type StudentAttempt = Tables<'student_attempts'>

// Function to get base_class_id and verify enrollment
async function verifyEnrollment(
  supabase: any,
  userId: string,
  assessment: Assessment
): Promise<{ isEnrolled: boolean; error?: string }> {
  try {
    console.log(`Starting enrollment verification for assessment ID: ${assessment.id}, type: ${assessment.assessment_type}`);
    
    let baseClassId: string | null = null;

    if (assessment.assessment_type === 'class') {
      baseClassId = assessment.base_class_id;
      console.log(`Assessment type is 'class'. Found base_class_id directly: ${baseClassId}`);
    } else if (assessment.assessment_type === 'path') {
      if (!assessment.path_id) {
        return { isEnrolled: false, error: `Path assessment is missing a path_id.` };
      }
      console.log(`Assessment type is 'path'. Looking up base_class_id for path_id: ${assessment.path_id}`);
      const { data: path, error: pathError } = await supabase
        .from('paths')
        .select('base_class_id')
        .eq('id', assessment.path_id)
        .single();
      
      if (pathError || !path?.base_class_id) {
        console.error('Error finding base class for path:', pathError);
        return { isEnrolled: false, error: `Could not find a valid base class for path ID: ${assessment.path_id}` };
      }
      baseClassId = path.base_class_id;
      console.log(`Found base_class_id: ${baseClassId} for path_id: ${assessment.path_id}`);
    } else if (assessment.assessment_type === 'lesson') {
      if (!assessment.lesson_id) {
        return { isEnrolled: false, error: `Lesson assessment is missing a lesson_id.` };
      }
      console.log(`Assessment type is 'lesson'. Looking up path for lesson_id: ${assessment.lesson_id}`);
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('path_id')
        .eq('id', assessment.lesson_id)
        .single();
      
      if (lessonError || !lesson?.path_id) {
        console.error('Error finding path for lesson:', lessonError);
        return { isEnrolled: false, error: `Could not find a valid path for lesson ID: ${assessment.lesson_id}` };
      }

      console.log(`Found path_id: ${lesson.path_id}. Looking up base_class_id.`);
      const { data: path, error: pathError } = await supabase
        .from('paths')
        .select('base_class_id')
        .eq('id', lesson.path_id)
        .single();

      if (pathError || !path?.base_class_id) {
        console.error('Error finding base class for path:', pathError);
        return { isEnrolled: false, error: `Could not find a valid base class for path ID: ${lesson.path_id}` };
      }
      baseClassId = path.base_class_id;
      console.log(`Found base_class_id: ${baseClassId} for lesson_id: ${assessment.lesson_id}`);
    }

    if (!baseClassId) {
      console.error(`Could not determine a base class for assessment ID: ${assessment.id}`);
      return { isEnrolled: false, error: 'Could not determine a base class for the assessment.' };
    }

    console.log(`Verifying enrollment for user ${userId} in base_class_id ${baseClassId}`);
    const { data: classInstances, error: ciError } = await supabase
      .from('class_instances')
      .select('id')
      .eq('base_class_id', baseClassId);
    
    if (ciError || !classInstances || classInstances.length === 0) {
      console.error(`No class instances found for base_class_id: ${baseClassId}`, ciError);
      return { isEnrolled: false, error: `No class instances found for base class ID: ${baseClassId}` };
    }

    const instanceIds = classInstances.map((ci: { id: string }) => ci.id);
    console.log(`Found class instance IDs: ${instanceIds.join(', ')}`);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('rosters')
      .select('id')
      .eq('profile_id', userId)
      .in('class_instance_id', instanceIds)
      .maybeSingle();

    if (enrollmentError) {
      console.error('Database error while checking enrollment:', enrollmentError.message);
      return { isEnrolled: false, error: `Database error while checking enrollment: ${enrollmentError.message}` };
    }

    console.log(`Enrollment check successful: ${!!enrollment}`);
    return { isEnrolled: !!enrollment };

  } catch (e: any) {
    console.error('Unexpected error in verifyEnrollment:', e.message);
    return { isEnrolled: false, error: 'An unexpected error occurred during enrollment verification.' };
  }
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[${requestId}] Starting assessment start request`);
    
    const supabase = createSupabaseServerClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log(`[${requestId}] Unauthorized: ${userError?.message || 'No user'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assessmentId } = await request.json()
    console.log(`[${requestId}] Assessment ID: ${assessmentId}, User ID: ${user.id}`);

    if (!assessmentId) {
      console.log(`[${requestId}] Missing assessment ID`);
      return NextResponse.json({ error: 'Assessment ID is required' }, { status: 400 })
    }

    // Get assessment details
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .single<Assessment>()

    if (assessmentError || !assessment) {
      console.log(`[${requestId}] Assessment not found: ${assessmentError?.message}`);
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    console.log(`[${requestId}] Found assessment: ${assessment.title}`);

    // NEW: Verify that the user is enrolled in the course for this assessment
    const { isEnrolled, error: enrollmentError } = await verifyEnrollment(supabase, user.id, assessment);
    if (!isEnrolled) {
      console.log(`[${requestId}] Enrollment verification failed: ${enrollmentError}`);
      return NextResponse.json({ error: enrollmentError || 'You are not enrolled in this course.' }, { status: 403 });
    }

    console.log(`[${requestId}] Enrollment verified successfully`);

    // Check existing attempts with explicit logging
    console.log(`[${requestId}] Checking existing attempts...`);
    const { data: existingAttempts, error: attemptsError } = await supabase
      .from('student_attempts')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('student_id', user.id)
      .order('attempt_number', { ascending: false })
      .returns<StudentAttempt[]>()

    if (attemptsError) {
      console.error(`[${requestId}] Failed to check existing attempts:`, attemptsError);
      return NextResponse.json({ error: 'Failed to check existing attempts' }, { status: 500 })
    }

    console.log(`[${requestId}] Found ${existingAttempts?.length || 0} existing attempts`);

    // Check if there's already an in-progress attempt
    const inProgressAttempt = existingAttempts?.find(attempt => attempt.status === 'in_progress')
    if (inProgressAttempt) {
      console.log(`[${requestId}] Returning existing in-progress attempt: ${inProgressAttempt.id}`);
      
      // Return the existing in-progress attempt instead of creating a new one
      const { data: questions, error: questionsError } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index')
        .returns<AssessmentQuestion[]>()

      if (questionsError || !questions) {
        console.error(`[${requestId}] Failed to load questions for existing attempt:`, questionsError);
        return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
      }

      // Remove answer keys from questions before sending to client
      const sanitizedQuestions = questions.map(question => {
        const { answer_key, ...questionWithoutAnswerKey } = question
        return questionWithoutAnswerKey
      })

      console.log(`[${requestId}] Successfully returning existing attempt with ${sanitizedQuestions.length} questions`);
      return NextResponse.json({
        assessment,
        questions: sanitizedQuestions,
        attempt: inProgressAttempt
      })
    }

    // Check attempt limits
    const currentAttemptNumber = (existingAttempts?.[0]?.attempt_number || 0) + 1
    console.log(`[${requestId}] Creating attempt number: ${currentAttemptNumber}`);
    
    if (assessment.max_attempts && currentAttemptNumber > assessment.max_attempts) {
      console.log(`[${requestId}] Maximum attempts exceeded: ${currentAttemptNumber} > ${assessment.max_attempts}`);
      return NextResponse.json({ error: 'Maximum attempts exceeded' }, { status: 400 })
    }

    // Get all questions for this assessment
    console.log(`[${requestId}] Loading questions...`);
    const { data: questions, error: questionsError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('order_index')
      .returns<AssessmentQuestion[]>()

    if (questionsError || !questions) {
      console.error(`[${requestId}] Failed to load questions:`, questionsError);
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
    }

    console.log(`[${requestId}] Loaded ${questions.length} questions`);

    // Create a new attempt record with 'in_progress' status
    const attemptData: TablesInsert<'student_attempts'> = {
      assessment_id: assessmentId,
      student_id: user.id,
      attempt_number: currentAttemptNumber,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      ai_grading_status: 'pending'
    }

    console.log(`[${requestId}] Creating new attempt...`);
    const { data: newAttempt, error: attemptError } = await supabase
      .from('student_attempts')
      .insert(attemptData)
      .select()
      .single<StudentAttempt>()

    if (attemptError || !newAttempt) {
      console.error(`[${requestId}] Failed to create attempt:`, attemptError);
      return NextResponse.json({ error: `Failed to create attempt: ${attemptError?.message || 'Unknown error'}` }, { status: 500 })
    }

    console.log(`[${requestId}] Successfully created new attempt: ${newAttempt.id}`);

    // Remove answer keys from questions before sending to client
    const sanitizedQuestions = questions.map(question => {
      const { answer_key, ...questionWithoutAnswerKey } = question
      return questionWithoutAnswerKey
    })

    console.log(`[${requestId}] Successfully completed request`);
    return NextResponse.json({
      assessment,
      questions: sanitizedQuestions,
      attempt: newAttempt
    })

  } catch (error: any) {
    console.error(`[${requestId}] Error starting assessment:`, error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, { status: 500 })
  }
} 