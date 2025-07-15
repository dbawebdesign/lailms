import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use admin client that bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    // Fetch regular survey responses (authenticated users)
    const { data: surveyData, error: surveyError } = await supabaseAdmin
      .from('survey_responses')
      .select(`
        *,
        survey_question_responses (
          question_id,
          response_value,
          response_text,
          survey_questions (
            id,
            question_text,
            question_type,
            options,
            section_id,
            survey_sections (
              title
            )
          )
        )
      `)
      .order('completed_at', { ascending: false })

    if (surveyError) {
      console.error('Survey data fetch error:', surveyError)
      throw surveyError
    }

    // Fetch public survey responses (anonymous users)
    const { data: publicSurveyData, error: publicSurveyError } = await supabaseAdmin
      .from('public_survey_responses')
      .select(`
        *,
        public_survey_question_responses (
          question_id,
          response_value,
          public_survey_questions (
            id,
            question_text,
            question_type,
            options,
            section_id,
            public_survey_sections (
              title
            )
          )
        )
      `)
      .order('completed_at', { ascending: false })

    if (publicSurveyError) {
      console.error('Public survey data fetch error:', publicSurveyError)
      throw publicSurveyError
    }

    // Fetch all questions for reference (both regular and public)
    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('survey_questions')
      .select(`
        *,
        survey_sections (
          title
        )
      `)
      .order('section_id', { ascending: true })
      .order('order_index', { ascending: true })

    if (questionsError) {
      console.error('Questions data fetch error:', questionsError)
      throw questionsError
    }

    const { data: publicQuestionsData, error: publicQuestionsError } = await supabaseAdmin
      .from('public_survey_questions')
      .select(`
        *,
        public_survey_sections (
          title
        )
      `)
      .order('section_id', { ascending: true })
      .order('order_index', { ascending: true })

    if (publicQuestionsError) {
      console.error('Public questions data fetch error:', publicQuestionsError)
      throw publicQuestionsError
    }

    // Transform regular survey data
    const responses = surveyData.map(response => ({
      ...response,
      source: 'authenticated', // Mark as authenticated user survey
      question_responses: response.survey_question_responses.map((qr: any) => ({
        question_id: qr.question_id,
        response_value: qr.response_value,
        response_text: qr.response_text,
        question: {
          id: qr.survey_questions.id,
          question_text: qr.survey_questions.question_text,
          question_type: qr.survey_questions.question_type,
          options: qr.survey_questions.options,
          section_id: qr.survey_questions.section_id,
          section_title: qr.survey_questions.survey_sections?.title || ''
        }
      }))
    }))

    // Transform public survey data
    const publicResponses = publicSurveyData.map(response => ({
      ...response,
      source: 'public', // Mark as public survey
      user_id: null, // Public surveys don't have user_id
      question_responses: response.public_survey_question_responses.map((qr: any) => ({
        question_id: qr.question_id,
        response_value: qr.response_value,
        response_text: null, // Public surveys don't have response_text
        question: {
          id: qr.public_survey_questions.id,
          question_text: qr.public_survey_questions.question_text,
          question_type: qr.public_survey_questions.question_type,
          options: qr.public_survey_questions.options,
          section_id: qr.public_survey_questions.section_id,
          section_title: qr.public_survey_questions.public_survey_sections?.title || ''
        }
      }))
    }))

    // Combine all responses
    const allResponses = [...responses, ...publicResponses]

    // Transform regular questions
    const questions = questionsData.map(question => ({
      ...question,
      source: 'authenticated',
      section_title: question.survey_sections?.title || ''
    }))

    // Transform public questions
    const publicQuestions = publicQuestionsData.map(question => ({
      ...question,
      source: 'public',
      section_title: question.public_survey_sections?.title || ''
    }))

    // Combine all questions
    const allQuestions = [...questions, ...publicQuestions]

    console.log(`Fetched ${responses.length} authenticated survey responses, ${publicResponses.length} public survey responses, and ${allQuestions.length} total questions`)

    return NextResponse.json({
      responses: allResponses,
      questions: allQuestions,
      totalResponses: allResponses.length,
      authenticatedResponses: responses.length,
      publicResponses: publicResponses.length
    })

  } catch (error) {
    console.error('Survey analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey analytics data' },
      { status: 500 }
    )
  }
} 