import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";
import { isTeacher, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user profile to verify teacher role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_ROLE_FIELDS)
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (profileError || !profile || !isTeacher(profile)) {
      return NextResponse.json({ error: 'Access denied. Teacher role required.' }, { status: 403 });
    }

    const { centralTopic, gradeLevel, subtopics, style, complexity } = await request.json();

    // Validate required fields
    if (!centralTopic || !gradeLevel) {
      return NextResponse.json({ 
        error: 'Missing required fields: centralTopic and gradeLevel are required' 
      }, { status: 400 });
    }

    // GPT-4.1-mini optimized prompt for comprehensive content generation
    const systemPrompt = `# Role and Objective
You are an expert educational mind map designer with extensive experience in visual learning tools and cognitive mapping techniques for K-12 education. You specialize in creating detailed, comprehensive mind maps that serve as complete learning resources.

# Instructions
Create a comprehensive and detailed mind map structure for the given topic that follows educational best practices:

1. **Central Topic Analysis**: Analyze the provided central topic and grade level to determine appropriate complexity and scope
2. **Branch Structure Creation**: Design 6-10 main branches that logically organize the topic's key concepts
3. **Sub-branch Development**: For each main branch, create 4-8 relevant sub-branches with comprehensive details
4. **Educational Alignment**: Ensure all content is grade-appropriate and educationally sound
5. **Visual Organization**: Structure the mind map for optimal visual hierarchy and learning flow
6. **Comprehensive Coverage**: Provide extensive detail and multiple perspectives on each concept

## Content Requirements
- Use clear, concise terminology appropriate for the specified grade level
- Include concrete examples and real-world connections where relevant
- Ensure logical relationships between all branches and sub-branches
- Incorporate different types of information (facts, concepts, examples, applications, processes)
- Make connections between different branches where appropriate
- Provide rich descriptions for each sub-branch (2-3 sentences minimum)
- Include relevant keywords and terminology for each sub-branch
- Cover multiple aspects and perspectives of the central topic

## Quality Standards
- All content must be factually accurate and educationally appropriate
- Language should be engaging and accessible for the target grade level
- Include actionable learning elements (not just abstract concepts)
- Ensure comprehensive coverage with substantial detail
- Provide enough content for extended study and exploration
- Include both foundational concepts and advanced applications

# Output Format
Provide your response as a structured JSON object with this exact format:

\`\`\`json
{
  "title": "Mind Map Title",
  "centralTopic": "Central topic name",
  "metadata": {
    "gradeLevel": "Grade level",
    "style": "Visual style preference",
    "complexity": "Complexity level",
    "totalBranches": "Number of main branches",
    "estimatedTime": "Time to review/study",
    "subject": "Primary subject area"
  },
  "branches": [
    {
      "id": 1,
      "title": "Main Branch Title",
      "color": "#hexcolor",
      "subBranches": [
        {
          "id": "1.1",
          "title": "Sub-branch title",
          "description": "Brief explanation or example",
          "keywords": ["key", "terms"]
        }
      ]
    }
  ],
  "connections": [
    {
      "from": "1.2",
      "to": "2.1",
      "relationship": "Description of connection"
    }
  ],
  "visualNotes": {
    "layout": "Suggested layout approach",
    "emphasis": "Areas to emphasize visually",
    "colors": "Color scheme rationale"
  }
}
\`\`\`

# Examples

## Example: Grade 5 Ecosystems Mind Map
\`\`\`json
{
  "title": "Forest Ecosystem Connections",
  "centralTopic": "Forest Ecosystem",
  "metadata": {
    "gradeLevel": "5",
    "style": "Colorful",
    "complexity": "Detailed",
    "totalBranches": 6,
    "estimatedTime": "20-25 minutes",
    "subject": "Science"
  },
  "branches": [
    {
      "id": 1,
      "title": "Living Components",
      "color": "#2E8B57",
      "subBranches": [
        {
          "id": "1.1",
          "title": "Producers",
          "description": "Trees, bushes, and grass that make their own food through photosynthesis. They form the foundation of all forest food chains by converting sunlight into energy.",
          "keywords": ["photosynthesis", "plants", "energy", "autotrophs"]
        },
        {
          "id": "1.2",
          "title": "Primary Consumers",
          "description": "Herbivorous animals like deer, rabbits, and squirrels that eat plants directly. They play a crucial role in transferring energy from producers to higher levels.",
          "keywords": ["herbivores", "plant-eaters", "energy transfer"]
        }
      ]
    },
    {
      "id": 2,
      "title": "Non-Living Components",
      "color": "#8B4513",
      "subBranches": [
        {
          "id": "2.1",
          "title": "Soil",
          "description": "Rich forest soil provides nutrients for plants and homes for countless organisms. It's formed from decomposed organic matter and weathered rocks.",
          "keywords": ["nutrients", "decomposition", "habitat", "minerals"]
        }
      ]
    }
  ]
}
\`\`\`

# Final Instructions
Think step by step about the educational goals for this grade level. Create a mind map that serves as both a learning tool and a study reference. Focus on clarity, logical organization, and age-appropriate depth.`;

    const userPrompt = `Create a mind map for the following specifications:

**Central Topic**: ${centralTopic}
**Grade Level**: ${gradeLevel}
**Style Preference**: ${style || 'Colorful'}
**Complexity Level**: ${complexity || 'Detailed'}
${subtopics ? `**Suggested Subtopics**: ${subtopics}` : ''}

Generate a comprehensive mind map structure that helps students understand and organize information about this topic.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 12000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    let mindmapData;
    
    if (jsonMatch) {
      try {
        mindmapData = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        mindmapData = null;
      }
    }

    // Generate metadata
    const metadata = {
      subject: mindmapData?.metadata?.subject || 'General',
      gradeLevel: gradeLevel,
      style: style || 'Colorful',
      complexity: complexity || 'Detailed',
      generatedAt: new Date().toISOString(),
      wordCount: content.length,
      estimatedTime: mindmapData?.metadata?.estimatedTime || '10-15 minutes',
      totalBranches: mindmapData?.branches?.length || 0
    };

    return NextResponse.json({
      content,
      mindmapData,
      metadata,
      success: true
    });

  } catch (error) {
    console.error('Mind map generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate mind map. Please try again.' },
      { status: 500 }
    );
  }
} 