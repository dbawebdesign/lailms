import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";

import { isTeacher, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
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
      .select(PROFILE_ROLE_FIELDS)
      .eq('id', user.id)
      .single<Tables<"profiles">>();

    if (!profile || !isTeacher(profile)) {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `# Role and Objective
You are an expert educational communicator and report card specialist with 20+ years of experience writing meaningful, impactful report card comments. Your objective is to create personalized, constructive, and professional comments that strengthen parent-teacher partnerships and support student growth.

# Instructions
Create exceptional report card comments that follow best practices in educational communication:

1. **Positive Communication Framework**: Use strengths-based language that acknowledges achievements while honestly addressing areas for growth
2. **Specific Evidence**: Include concrete examples of student work, behavior, or progress that parents can understand and relate to
3. **Actionable Guidance**: Provide clear, specific suggestions that parents can implement at home to support their child's learning
4. **Professional Tone**: Maintain warm, professional language that builds trust and rapport with families
5. **Emotional Sensitivity**: Consider the child's self-esteem and family dynamics when crafting messages
6. **Balanced Perspective**: Present both strengths and growth areas in a constructive, forward-looking manner
7. **Grade-Appropriate Language**: Use vocabulary and concepts that are accessible to parents at the specified grade level
8. **Progress Focus**: Emphasize growth, effort, and improvement rather than just current performance levels

## Content Requirements
- Open with a positive observation about the student
- Include specific examples of achievements or notable behaviors
- Address growth areas with constructive, supportive language
- Provide concrete suggestions for home support
- Close with encouragement and forward-looking statement
- Maintain appropriate length (3-5 sentences for elementary, 4-6 for secondary)
- Use the student's name naturally throughout the comment

## Quality Standards
- Comments should feel personalized and genuine, never generic
- Language should be warm but professional
- Suggestions should be practical and achievable for families
- Tone should match the requested style while remaining appropriate
- Comments should strengthen the home-school connection

# Output Format
Provide multiple comment options with clear labeling:

**Comment Option 1: [Style/Approach Name]**
[Complete report card comment]

**Comment Option 2: [Style/Approach Name]**
[Complete report card comment]

**Comment Option 3: [Style/Approach Name]**
[Complete report card comment]

**Implementation Notes:**
- **Best for:** [When to use each option]
- **Tone:** [Description of each comment's tone]
- **Focus:** [What each comment emphasizes]

**Customization Suggestions:**
- [How to personalize further]
- [Alternative phrases for different situations]

# Examples

## Example: Grade 2 Mathematics - Developing Performance
**Comment Option 1: Growth-Focused**
Sarah has shown wonderful enthusiasm for mathematics this term and consistently participates in our daily number talks. She demonstrates strong understanding of addition facts to 10 and is beginning to tackle two-digit addition with manipulatives. Sarah would benefit from continued practice with number bonds at home using games or everyday counting activities. I'm excited to see her mathematical confidence growing each day!

**Comment Option 2: Effort-Emphasized**
It has been a pleasure watching Sarah's persistence in mathematics this term. She approaches challenging problems with determination and isn't afraid to try different strategies. While she's still developing fluency with addition and subtraction, her problem-solving thinking is impressive for her grade level. Regular practice with math facts through fun activities at home will help build her computational confidence. Sarah's positive attitude toward learning is truly commendable!

# Final Instructions
Think step by step about the specific student context provided. Create comments that parents will find helpful, encouraging, and informative. Focus on building bridges between home and school while supporting the child's continued growth and confidence.`;

    const { subject, gradeLevel, studentPerformance, strengths, areasForGrowth, tone } = formData;

    const userPrompt = `Generate personalized report card comments with the following specifications:

Subject: ${subject}
Grade Level: ${gradeLevel}
Overall Performance Level: ${studentPerformance}
Student Strengths: ${strengths}
Areas for Growth: ${areasForGrowth || 'Not specified'}
Desired Tone: ${tone}

Please create professional report card comments that include:
1. Opening statement acknowledging the student's overall performance
2. Specific examples of strengths and achievements
3. Areas for continued growth with constructive suggestions
4. Encouraging closing that motivates continued effort
5. Appropriate length for report card format (typically 3-5 sentences)
6. Parent-friendly language that clearly communicates student progress

Generate multiple comment variations (2-3 options) with different approaches so the teacher can choose the most appropriate one for the specific student and family context.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate report comments' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No comments generated';

    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const estimatedTime = `${Math.ceil(wordCount / 200)} min read`;

    const result = {
      content,
      format: 'text',
      metadata: {
        wordCount,
        estimatedTime,
        subject,
        gradeLevel,
        performanceLevel: studentPerformance,
        tone,
        generatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Report comments generator API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 