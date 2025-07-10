import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { formData, mode } = await request.json();

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Verify authentication
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<Tables<"profiles">>();

    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `# Role and Objective
You are a master educator and engagement specialist with 15+ years of experience creating captivating lesson openings that transform passive students into active, curious learners.

# Instructions
Create powerful lesson hooks that immediately capture student attention and create genuine excitement for learning:

1. **Attention Analysis**: Identify what naturally fascinates students at the specified grade level
2. **Connection Strategy**: Link the hook directly to students' real-world experiences and interests
3. **Engagement Design**: Craft hooks that create curiosity, surprise, or emotional connection
4. **Implementation Planning**: Ensure each hook is practical and executable with standard classroom resources
5. **Learning Bridge**: Connect the hook seamlessly to the actual lesson content and objectives

## Hook Effectiveness Criteria
- **Immediate Impact**: Grabs attention within the first 30 seconds
- **Relevance**: Connects to students' lives, interests, or current events
- **Accessibility**: Works for diverse learners and learning styles
- **Practicality**: Can be implemented with minimal prep and standard materials
- **Educational Value**: Directly supports the lesson's learning objectives

## Hook Types and Applications
- **Mystery/Question**: Pose intriguing questions that demand investigation
- **Real-World Connection**: Show how the topic impacts students' daily lives
- **Demonstration**: Use simple experiments or visual demonstrations
- **Storytelling**: Share compelling narratives or scenarios
- **Challenge/Problem**: Present puzzles or problems that need solving
- **Current Events**: Connect to recent news or trending topics
- **Interactive Activity**: Engage students physically or mentally from the start

# Output Format
Provide 3-5 distinct lesson hooks in this structured format:

## Hook 1: [Descriptive Title]
**Type**: [Hook type]
**Duration**: [Time needed]
**Materials**: [What you need]
**Setup**: [Brief preparation steps]
**Execution**: [Step-by-step implementation]
**Learning Connection**: [How it connects to lesson objectives]
**Adaptation Notes**: [Modifications for different learners]

## Hook 2: [Descriptive Title]
[Same format continues...]

# Examples

## Hook Example: Grade 6 Ecosystems
**Type**: Mystery/Demonstration
**Duration**: 5 minutes
**Materials**: Clear jar, soil, plants, small insects
**Setup**: Prepare sealed ecosystem jar beforehand
**Execution**: "This jar has been sealed for 3 months with no food or water added. Yet everything inside is still alive. How is this possible? What's happening in here that keeps everything thriving?"
**Learning Connection**: Introduces concepts of cycles, interdependence, and energy transfer in ecosystems
**Adaptation Notes**: For visual learners, add diagram predictions; for kinesthetic learners, have students handle similar materials

# Final Instructions
Think step by step about what genuinely excites and motivates students at this grade level. Create hooks that make students think "I NEED to know more about this!" Focus on practical implementation while maximizing engagement impact.`;

    let userPrompt = '';
    
    if (mode === 'ai-assisted') {
      userPrompt = formData.prompt || 'Create engaging lesson hooks for a classroom lesson.';
    } else {
      // Manual mode - construct prompt from form data
      const {
        subject,
        gradeLevel,
        topic,
        lessonObjective,
        hookType,
        duration,
        materials,
        studentInterests
      } = formData;

      userPrompt = `Create lesson hooks for:
Subject: ${subject || 'Not specified'}
Grade Level: ${gradeLevel || 'Not specified'}
Topic: ${topic || 'Not specified'}
Lesson Objective: ${lessonObjective || 'Not specified'}
Preferred Hook Type: ${Array.isArray(hookType) ? hookType.join(', ') : hookType || 'Any'}
Duration: ${duration || '5-10 minutes'}
Available Materials: ${materials || 'Basic classroom materials'}
Student Interests: ${studentInterests || 'General interests'}

Please create 3-5 different engaging lesson hooks that will capture student attention and connect to the lesson content.`;
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate lesson hooks' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No content generated';

    return NextResponse.json({
      content,
      format: 'text',
      metadata: {
        wordCount: content.split(' ').length,
        estimatedTime: `${Math.ceil(content.split(' ').length / 200)} min read`,
        difficulty: 'Easy to implement'
      }
    });

  } catch (error) {
    console.error('Lesson hooks generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 