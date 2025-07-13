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
    // Fetch survey responses with all question responses using admin client
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

    // Fetch all questions for reference
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

    // Transform the data
    const responses = surveyData.map(response => ({
      ...response,
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

    const questions = questionsData.map(question => ({
      ...question,
      section_title: question.survey_sections?.title || ''
    }))

    console.log(`Fetched ${responses.length} survey responses and ${questions.length} questions`)

    return NextResponse.json({
      responses,
      questions,
      totalResponses: responses.length
    })

  } catch (error) {
    console.error('Survey analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey analytics data' },
      { status: 500 }
    )
  }
} 