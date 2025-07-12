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
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (!profile || !isTeacher(profile)) {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `# Role and Objective
You are an expert in differentiated instruction and educational psychology with 15+ years of classroom experience. Your objective is to create multiple, distinct explanations of the same concept that enable all students to access learning through their preferred pathways and strengths.

# Instructions
Create comprehensive, varied explanations that follow differentiated instruction best practices:

1. **Accuracy Maintenance**: Ensure all explanations are scientifically and academically accurate while varying the approach
2. **Grade-Level Adaptation**: Adjust complexity, vocabulary, and examples to be perfectly appropriate for the specified grade level
3. **Learning Style Accommodation**: Address visual, auditory, kinesthetic, and reading/writing learning preferences
4. **Cultural Responsiveness**: Include diverse examples and perspectives that reflect various cultural backgrounds
5. **Engagement Strategies**: Use age-appropriate, interesting examples that connect to students' experiences
6. **Implementation Support**: Provide practical teaching tips and classroom strategies for each explanation
7. **Accessibility Focus**: Ensure each explanation can stand alone while covering the same core learning objectives

## Content Requirements
- Each explanation must cover the same core concept completely
- Use different approaches, analogies, and examples for each explanation
- Include specific vocabulary appropriate for the grade level
- Provide concrete, relatable examples students can visualize
- Connect to real-world applications and student experiences
- Address potential misconceptions proactively

## Quality Standards
- Explanations should be engaging and memorable
- Include diverse perspectives and examples
- Provide clear, step-by-step progression of ideas
- Use active voice and clear, direct language
- Include specific implementation guidance for teachers

# Output Format
Structure your response with clear sections for each explanation:

**Explanation 1: [Type/Style Name]**
**Target Learners:** [Specific learner types this addresses]
**Core Explanation:**
[Detailed explanation using this approach]

**Teaching Implementation:**
- Setup: [How to introduce this explanation]
- Delivery: [How to present it effectively]
- Engagement: [How to keep students involved]
- Assessment: [How to check understanding]

**Follow-up Activities:**
- [Specific activity suggestions]
- [Extension opportunities]

[Repeat format for each explanation...]

**Cross-Explanation Connections:**
- [How these explanations reinforce each other]
- [Strategies for using multiple explanations together]

# Examples

## Example: Fractions (Grade 3)
**Explanation 1: Visual/Spatial Approach**
**Target Learners:** Visual learners, students who learn through pictures and diagrams
**Core Explanation:**
Think of fractions like pizza slices! When we write 1/4, we're talking about 1 piece of a pizza that's been cut into 4 equal slices. The bottom number (4) tells us how many equal pieces the whole pizza was cut into. The top number (1) tells us how many pieces we're talking about...

# Final Instructions
Think step by step about how different students learn best. Create explanations that genuinely offer different pathways to the same understanding. Focus on making each explanation complete, engaging, and immediately usable by teachers.`;

    const { concept, gradeLevel, explanationTypes, learnerTypes, contextualInfo } = formData;

    const explanationTypesStr = Array.isArray(explanationTypes) ? explanationTypes.join(', ') : explanationTypes;
    const learnerTypesStr = Array.isArray(learnerTypes) ? learnerTypes.join(', ') : learnerTypes;

    const userPrompt = `Create multiple explanations for the following concept:

Concept: ${concept}
Grade Level: ${gradeLevel}
Types of Explanations Requested: ${explanationTypesStr}
Target Learner Types: ${learnerTypesStr}
Additional Context: ${contextualInfo || 'Not provided'}

Please create distinct explanations that:
1. Address each requested explanation type
2. Cater to the specified learner types
3. Are appropriate for ${gradeLevel} grade level
4. Maintain accuracy while varying approach
5. Include practical implementation suggestions for teachers
6. Use engaging, relatable examples
7. Consider diverse student backgrounds and experiences

Format each explanation clearly with:
- A descriptive heading
- The explanation itself
- Implementation tips for teachers
- Suggested follow-up activities or questions`;

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
        { error: 'Failed to generate explanations' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No explanations generated';

    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const estimatedTime = `${Math.ceil(wordCount / 200)} min read`;

    const result = {
      content,
      format: 'text',
      metadata: {
        wordCount,
        estimatedTime,
        concept,
        gradeLevel,
        explanationTypes: explanationTypesStr,
        learnerTypes: learnerTypesStr,
        generatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Multiple explanations generator API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 