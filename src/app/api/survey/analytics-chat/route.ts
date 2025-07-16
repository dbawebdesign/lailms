import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Use admin client that bypasses RLS to get ALL survey data
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Fetch all regular survey data for context using admin client
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
            order_index,
            survey_sections (
              title,
              description
            )
          )
        )
      `)
      .order('completed_at', { ascending: false })

    if (surveyError) {
      console.error('Error fetching survey data:', surveyError)
      return NextResponse.json({ error: 'Failed to fetch survey data' }, { status: 500 })
    }

    // Fetch all public survey data for context using admin client
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
            order_index,
            public_survey_sections (
              title,
              description
            )
          )
        )
      `)
      .order('completed_at', { ascending: false })

    if (publicSurveyError) {
      console.error('Error fetching public survey data:', publicSurveyError)
      return NextResponse.json({ error: 'Failed to fetch public survey data' }, { status: 500 })
    }

    // Fetch all questions for reference (regular surveys)
    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('survey_questions')
      .select(`
        *,
        survey_sections (
          title,
          description
        )
      `)
      .order('section_id', { ascending: true })
      .order('order_index', { ascending: true })

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions data' }, { status: 500 })
    }

    // Fetch all public questions for reference
    const { data: publicQuestionsData, error: publicQuestionsError } = await supabaseAdmin
      .from('public_survey_questions')
      .select(`
        *,
        public_survey_sections (
          title,
          description
        )
      `)
      .order('section_id', { ascending: true })
      .order('order_index', { ascending: true })

    if (publicQuestionsError) {
      console.error('Error fetching public questions:', publicQuestionsError)
      return NextResponse.json({ error: 'Failed to fetch public questions data' }, { status: 500 })
    }

    // Transform regular survey data for AI context
    const transformedResponses = surveyData.map((response: any) => ({
      response_id: response.id,
      user_id: response.user_id,
      completed_at: response.completed_at,
      duration_seconds: response.duration_seconds,
      device_info: response.device_info,
      source: 'authenticated_user',
      responses: response.survey_question_responses.map((qr: any) => ({
        question_id: qr.question_id,
        question_text: qr.survey_questions.question_text,
        question_type: qr.survey_questions.question_type,
        section_title: qr.survey_questions.survey_sections.title,
        section_description: qr.survey_questions.survey_sections.description,
        response_value: qr.response_value,
        response_text: qr.response_text,
        options: qr.survey_questions.options
      }))
    }))

    // Transform public survey data for AI context
    const transformedPublicResponses = publicSurveyData.map((response: any) => ({
      response_id: response.id,
      session_id: response.session_id,
      email: response.email,
      completed_at: response.completed_at,
      duration_seconds: response.duration_seconds,
      device_info: response.device_info,
      ip_address: response.ip_address,
      source: 'public_anonymous',
      responses: response.public_survey_question_responses.map((qr: any) => ({
        question_id: qr.question_id,
        question_text: qr.public_survey_questions.question_text,
        question_type: qr.public_survey_questions.question_type,
        section_title: qr.public_survey_questions.public_survey_sections.title,
        section_description: qr.public_survey_questions.public_survey_sections.description,
        response_value: qr.response_value,
        response_text: null, // Public surveys don't have response_text
        options: qr.public_survey_questions.options
      }))
    }))

    // Combine all responses
    const allTransformedResponses = [...transformedResponses, ...transformedPublicResponses]

    // Transform regular questions reference
    const questionsReference = questionsData.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      section_title: q.survey_sections.title,
      section_description: q.survey_sections.description,
      source: 'authenticated_user'
    }))

    // Transform public questions reference
    const publicQuestionsReference = publicQuestionsData.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      section_title: q.public_survey_sections.title,
      section_description: q.public_survey_sections.description,
      source: 'public_anonymous'
    }))

    // Combine all questions
    const allQuestionsReference = [...questionsReference, ...publicQuestionsReference]

    // Create comprehensive survey context for AI
    const surveyContext = {
      total_responses: allTransformedResponses.length,
      authenticated_responses: transformedResponses.length,
      public_responses: transformedPublicResponses.length,
      responses: allTransformedResponses,
      questions: allQuestionsReference,
      data_sources: {
        authenticated: "Responses from registered users who completed the survey after signing up",
        public: "Anonymous responses from public users who completed the survey without authentication, includes screening questions"
      }
    }

    // Enhanced system prompt to handle both data sources
    const systemPrompt = `You are Luna, a survey analytics assistant for Learnology AI. You have access to comprehensive survey data from both authenticated users and public anonymous responses.

DATA SOURCES:
1. Authenticated User Surveys: ${transformedResponses.length} responses from registered users
2. Public Anonymous Surveys: ${transformedPublicResponses.length} responses from anonymous users (includes screening questions)

SURVEY STRUCTURE:
- Both surveys cover similar topics: Problem Validation, Product Interest, Demographics, and Feedback
- Public surveys include additional screening questions to filter qualified respondents
- You can analyze patterns across both data sources or focus on specific segments

ANALYSIS CAPABILITIES:
- Identify pain points and challenges in homeschooling
- Analyze feature preferences and prioritization
- Examine demographic patterns and correlations
- Compare responses between authenticated and anonymous users
- Provide actionable insights for product development
- Generate data-driven recommendations

RESPONSE STYLE:
- Be analytical and data-driven
- Provide specific numbers and percentages
- Highlight key insights and patterns
- Suggest actionable next steps
- Mention data source when relevant (authenticated vs public)
- Use clear, professional language

Survey Data Context: ${JSON.stringify(surveyContext, null, 2)}`

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ]

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000
    })

    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    return NextResponse.json({ response })

  } catch (error) {
    console.error('Survey analytics chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process analytics request' },
      { status: 500 }
    )
  }
} 