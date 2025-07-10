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

    if (profile?.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `You are an expert special education professional and IEP (Individualized Education Program) specialist. Your role is to help create comprehensive, legally compliant, and educationally sound IEP documents that support student success.

Key responsibilities:
- Create detailed, measurable IEP goals and objectives
- Ensure compliance with IDEA (Individuals with Disabilities Education Act)
- Focus on student strengths and needs
- Provide specific accommodations and modifications
- Include appropriate assessment methods and progress monitoring
- Use person-first language throughout
- Ensure goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)

Generate professional IEP content that can be used by special education teams, ensuring all legal requirements are met while maintaining focus on student growth and success.`;

    let userPrompt = '';
    
    if (mode === 'ai-assisted') {
      userPrompt = formData.prompt || 'Create a comprehensive IEP for a student with specific learning needs.';
    } else {
      // Manual mode - construct prompt from form data
      const {
        studentName,
        grade,
        disability,
        currentPerformance,
        goalAreas,
        accommodations,
        services,
        timeline
      } = formData;

      userPrompt = `Create an IEP for:
Student: ${studentName || 'Student'}
Grade Level: ${grade || 'Not specified'}
Primary Disability: ${disability || 'Not specified'}
Current Performance Level: ${currentPerformance || 'Not specified'}
Goal Areas: ${Array.isArray(goalAreas) ? goalAreas.join(', ') : goalAreas || 'Not specified'}
Requested Accommodations: ${accommodations || 'Not specified'}
Special Education Services: ${services || 'Not specified'}
Timeline: ${timeline || 'Annual'}

Please create a comprehensive IEP including measurable goals, objectives, accommodations, and service provisions.`;
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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate IEP' },
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
        difficulty: 'Professional'
      }
    });

  } catch (error) {
    console.error('IEP generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 