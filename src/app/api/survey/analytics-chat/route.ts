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

    // Fetch all survey data for context using admin client
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

    // Fetch all questions for reference
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

    // Transform survey data for AI context
    const transformedResponses = surveyData.map((response: any) => ({
      response_id: response.id,
      user_id: response.user_id,
      completed_at: response.completed_at,
      duration_seconds: response.duration_seconds,
      device_info: response.device_info,
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

    const questionsReference = questionsData.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      section_title: q.survey_sections.title,
      section_description: q.survey_sections.description,
      order_index: q.order_index
    }))

    // Create system prompt with survey context
    const systemPrompt = `You are Luna, an AI analytics assistant for LearnologyAI's homeschool parent survey data. You have access to comprehensive survey response data and can provide detailed insights, analysis, and answer questions about the survey results.

SURVEY STRUCTURE:
- Section 1: Problem Validation (Questions 1-7) - Likert scale (Strongly Disagree to Strongly Agree)
- Section 2: Product Test (Questions 8-14) - Importance scale (Very Unimportant to Very Important)  
- Section 3: Primary Concerns (Question 15) - Multiple choice about AI adoption concerns
- Section 4: Demographics (Questions 16-23) - Mixed question types about background and preferences

SURVEY DATA SUMMARY:
- Total Responses: ${transformedResponses.length}
- Questions per Response: 23 questions across 4 sections
- Response Period: ${surveyData[surveyData.length - 1]?.completed_at} to ${surveyData[0]?.completed_at}

AVAILABLE DATA:
${JSON.stringify(transformedResponses, null, 2)}

QUESTIONS REFERENCE:
${JSON.stringify(questionsReference, null, 2)}

CAPABILITIES:
- Analyze response patterns and trends
- Calculate statistics and percentages
- Identify correlations between demographics and responses
- Provide business insights and recommendations
- Compare responses across different demographic segments
- Generate detailed reports on specific aspects of the data

ANALYSIS GUIDELINES:
- Always provide specific data points and percentages
- Reference exact question text when discussing responses
- Consider demographic context when making insights
- Suggest actionable business recommendations
- Be precise with statistical calculations
- Highlight significant patterns or outliers

When asked about the data, provide detailed, accurate analysis with specific numbers, percentages, and insights. Always ground your responses in the actual survey data provided.`

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages as any,
      temperature: 0.1,
      max_tokens: 2000,
      stream: false
    })

    const aiResponse = completion.choices[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    return NextResponse.json({
      response: aiResponse,
      usage: completion.usage
    })

  } catch (error) {
    console.error('Error in analytics chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 