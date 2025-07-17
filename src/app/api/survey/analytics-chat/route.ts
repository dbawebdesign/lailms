import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { visualizationGenerator, VisualizationRequest } from '@/lib/services/visualization-generator'

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

// Define visualization tool for Luna
const createDataVisualizationTool = {
  type: "function" as const,
  function: {
    name: "createDataVisualization",
    description: "Generate interactive data visualizations from survey data using advanced AI analysis",
    parameters: {
      type: "object",
      properties: {
        visualizationType: {
          type: "string",
          enum: ["chart", "infographic", "interactive", "presentation", "social-media"],
          description: "Type of visualization requested by the user"
        },
        dataFocus: {
          type: "string",
          description: "Specific data insights or relationships to visualize"
        },
        outputFormat: {
          type: "string",
          enum: ["html", "powerpoint", "social", "embed"],
          description: "Desired output format for the visualization"
        },
        userRequest: {
          type: "string",
          description: "The user's complete original request for context"
        },
        specificMetrics: {
          type: "array",
          items: { type: "string" },
          description: "Specific metrics, questions, or data points to highlight"
        }
      },
      required: ["visualizationType", "dataFocus", "outputFormat", "userRequest"]
    }
  }
}

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

    // Transform regular survey data
    const transformedResponses = surveyData.map(response => ({
      ...response,
      source: 'authenticated',
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
    const transformedPublicResponses = publicSurveyData.map(response => ({
      ...response,
      source: 'public',
      user_id: null,
      question_responses: response.public_survey_question_responses.map((qr: any) => ({
        question_id: qr.question_id,
        response_value: qr.response_value,
        response_text: null,
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
    const allTransformedResponses = [...transformedResponses, ...transformedPublicResponses]

    // Transform questions
    const questionsReference = questionsData.map(question => ({
      ...question,
      source: 'authenticated',
      section_title: question.survey_sections?.title || ''
    }))

    const publicQuestionsReference = publicQuestionsData.map(question => ({
      ...question,
      source: 'public',
      section_title: question.public_survey_sections?.title || ''
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

    // GPT-4.1 optimized system prompt with visualization detection
    const enhancedSystemPrompt = `# Role and Objective
You are Luna, a survey analytics assistant for Learnology AI with expertise in data analysis and visualization detection. Your primary objective is to provide intelligent survey data insights while detecting when users request visual representations of data.

# Instructions

## Core Analytical Capabilities
1. **Data Analysis**: Provide comprehensive insights from both authenticated and public survey responses
2. **Pattern Recognition**: Identify trends, correlations, and significant findings in survey data
3. **Visualization Detection**: Recognize when users want visual representations, charts, graphics, or presentation materials
4. **Tool Integration**: Call specialized visualization tools when visual requests are detected

## Visualization Detection Guidelines
**Trigger Phrases to Watch For:**
- "create a visual" / "show me a chart/graph/infographic"
- "generate a visualization" / "make an interactive graphic"
- "create something for PowerPoint" / "build a social media post"
- "visualize this data" / "turn this into a graphic"
- "I need a visual showing..." / "can you create a chart that..."
- "make this into a presentation" / "create an infographic"

**Context Clues:**
- Requests mentioning data relationships for display
- Questions about "showing" or "displaying" data
- Requests for presentation or marketing materials
- Social media content requests

## Response Strategy
**For Regular Analytics Questions:**
- Provide detailed data insights using your analytical capabilities
- Use specific numbers, percentages, and statistical findings
- Highlight key insights and patterns
- Suggest actionable next steps
- Reference both authenticated and public survey data sources
- Use clear, professional language

**For Visualization Requests:**
- Use the createDataVisualization tool immediately
- Extract visualization type, data focus, and output format from user request
- Pass the complete user request to the visualization system

# Reasoning Steps
Before responding to each query:
1. **Request Analysis**: Determine if this is a standard analytics question or visualization request
2. **Data Context**: Consider relevant survey data for the response
3. **Tool Selection**: Choose appropriate response method (direct analysis vs visualization tool)
4. **Response Crafting**: Structure response to be most helpful for the user's needs

# Output Format
**For Standard Responses:**
- Provide analytical insights with specific data points
- Use clear, professional language
- Include actionable recommendations
- Reference data sources when relevant (authenticated vs public)

**For Visualization Requests:**
- Call createDataVisualization tool with proper parameters
- Provide context about what visualization will be created
- Set expectations for deliverables

# Survey Data Context
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

Survey Data: ${JSON.stringify(surveyContext, null, 2)}

# Final Instructions
Think step by step about each user request. Provide data-driven insights for standard questions and seamlessly transition to visualization generation when visual representations are requested. Always maintain professional, analytical communication while being helpful and actionable.`

    // Build conversation messages
    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ]

    // Call OpenAI API with visualization tool
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages as any,
      tools: [createDataVisualizationTool],
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    })

    // Check if Luna wants to create a visualization
    if (completion.choices[0].message.tool_calls) {
      const toolCall = completion.choices[0].message.tool_calls[0]
      
      if (toolCall.function.name === 'createDataVisualization') {
        try {
          console.log('🎨 Luna detected visualization request, switching to o3 model...')
          
          // Parse tool arguments
          const toolArgs = JSON.parse(toolCall.function.arguments) as VisualizationRequest
          
          // Generate visualization using o3 model
          const visualizationResult = await visualizationGenerator.generateVisualization(
            toolArgs,
            surveyContext
          )
          
          return NextResponse.json({
            response: `I've created an interactive ${visualizationResult.type} visualization for your survey data! ${visualizationResult.description}

🎯 **What I've Created:**
- Interactive ${toolArgs.visualizationType} focusing on ${toolArgs.dataFocus}
- Professional ${toolArgs.outputFormat} format ready for use
- Data from ${visualizationResult.dataPointsUsed} survey responses
- Responsive design that works on all devices

📊 **Features:**
- Hover effects and interactive elements
- Professional styling and branding
- Downloadable HTML file
- Embed code for websites/presentations

🔗 **Ready to Use:**
- **Download**: Click the link below to save the visualization
- **Embed**: Use the provided embed code for websites
- **Share**: Direct link works for presentations and social media`,
            visualization: {
              file: visualizationResult.htmlFile,
              downloadUrl: visualizationResult.downloadUrl,
              embedCode: visualizationResult.embedCode,
              previewUrl: visualizationResult.previewUrl
            },
            metadata: visualizationResult.metadata
          })
          
        } catch (error) {
          console.error('Visualization generation error:', error)
          return NextResponse.json({
            response: "I detected that you want a visualization, but I encountered an error generating it. Let me provide you with the data analysis instead, and you can try requesting the visualization again.",
            error: 'visualization_failed'
          })
        }
      }
    }

    // Regular response using gpt-4.1-mini
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