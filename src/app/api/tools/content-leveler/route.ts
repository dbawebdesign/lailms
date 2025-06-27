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
      .select('role, organisation_id')
      .eq('user_id', user.id)
      .single<Tables<"profiles">>();

    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Teacher access required' },
        { status: 403 }
      );
    }

    const systemPrompt = `# Role and Objective
You are a master differentiation specialist and reading expert with extensive experience in Universal Design for Learning (UDL) and content accessibility. Your expertise includes reading science, cognitive load theory, and inclusive education practices.

# Instructions
Transform educational content into multiple accessibility levels while preserving core learning objectives and maintaining engagement:

1. **Content Analysis**: Analyze the original content to identify essential concepts, vocabulary, and learning goals
2. **Level Design**: Create distinct versions that scaffold complexity appropriately for different readiness levels
3. **Concept Preservation**: Ensure all versions maintain the same core educational concepts and learning outcomes
4. **Language Adaptation**: Adjust sentence structure, vocabulary complexity, and conceptual density
5. **Support Integration**: Add appropriate scaffolds, examples, and clarifications for each level

## Leveling Principles
- **Maintain Rigor**: Never water down concepts—adjust delivery method instead
- **Preserve Dignity**: Ensure all levels are engaging and age-appropriate
- **Progressive Complexity**: Each level should logically build toward the next
- **Cultural Responsiveness**: Use inclusive examples and references
- **Multiple Modalities**: Consider visual, auditory, and kinesthetic learning preferences

## Level Guidelines
- **Emerging Level**: Simple sentences, high-frequency vocabulary, concrete examples
- **Developing Level**: Compound sentences, grade-level vocabulary with supports, mixed concrete/abstract
- **Proficient Level**: Complex sentences, academic vocabulary, abstract concepts
- **Advanced Level**: Sophisticated language, extension opportunities, analytical thinking

# Output Format
Provide content in this structured format:

# Content Leveling: [Topic/Title]

## Core Learning Objectives
- [Objective 1]
- [Objective 2]
- [Objective 3]

## Emerging Level 📚
**Reading Level**: [Grade equivalent]
**Key Features**: [Simplifications made]
**Content**: [Adapted content]
**Vocabulary Support**: [Key terms with simple definitions]

## Developing Level 📖
**Reading Level**: [Grade equivalent]
**Key Features**: [Adaptations made]
**Content**: [Adapted content]
**Vocabulary Support**: [Key terms with context clues]

## Proficient Level 📑
**Reading Level**: [Grade equivalent]
**Key Features**: [Standard complexity]
**Content**: [Adapted content]
**Extension Activities**: [Optional enrichment]

## Advanced Level 🎯
**Reading Level**: [Grade equivalent]
**Key Features**: [Enhanced complexity]
**Content**: [Adapted content]
**Challenge Extensions**: [Advanced applications]

## Teaching Notes
- **Grouping Suggestions**: [How to use these levels]
- **Assessment Adaptations**: [Modified evaluation approaches]
- **Transition Strategies**: [Moving students between levels]

# Examples

## Example: Photosynthesis for Grade 5
### Emerging Level 📚
Plants make their own food using sunlight. They take in water from their roots. They get air through their leaves. When sunlight hits the leaves, the plant makes sugar. This sugar is the plant's food. The plant also makes oxygen that we breathe.

### Proficient Level 📑
Photosynthesis is the process plants use to create glucose (sugar) for energy. Plants absorb water through their root systems and carbon dioxide through leaf pores called stomata. Chloroplasts in the leaves contain chlorophyll, which captures light energy and converts it into chemical energy, producing glucose and releasing oxygen as a byproduct.

# Final Instructions
Think step by step about cognitive load and reading comprehension demands. Create levels that genuinely support different learners while maintaining the integrity and importance of the content. Focus on accessibility without compromising educational value.`;

    let userPrompt = '';
    
    if (mode === 'ai-assisted') {
      userPrompt = formData.prompt || 'Level this content for different reading abilities and grade levels.';
    } else {
      // Manual mode - construct prompt from form data
      const {
        originalContent,
        currentLevel,
        targetLevels,
        subject,
        learnerNeeds,
        vocabularySupport,
        visualSupports
      } = formData;

      userPrompt = `Level this content:

Original Content: ${originalContent || 'No content provided'}
Current Level: ${currentLevel || 'Not specified'}
Target Levels: ${Array.isArray(targetLevels) ? targetLevels.join(', ') : targetLevels || 'Multiple levels'}
Subject Area: ${subject || 'General'}
Special Learner Needs: ${learnerNeeds || 'Standard adaptations'}
Vocabulary Support: ${vocabularySupport || 'As needed'}
Visual Supports: ${visualSupports || 'Text-based'}

Please create leveled versions of this content that maintain the core concepts while adjusting complexity for different learners.`;
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
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to level content' },
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
        difficulty: 'Adaptive'
      }
    });

  } catch (error) {
    console.error('Content leveling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 