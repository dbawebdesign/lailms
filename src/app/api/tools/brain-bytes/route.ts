import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Access denied. Teacher role required.' }, { status: 403 });
    }

    const { topic, gradeLevel, byteTypes, count, format } = await request.json();

    // Validate required fields
    if (!topic || !gradeLevel) {
      return NextResponse.json({ 
        error: 'Missing required fields: topic and gradeLevel are required' 
      }, { status: 400 });
    }

    // GPT-4.1-mini optimized prompt
    const systemPrompt = `# Role and Objective
You are an expert educational content creator specializing in bite-sized, engaging learning content for K-12 students. Your expertise includes cognitive science, attention spans, and making complex topics accessible and memorable.

# Instructions
Create compelling BrainBytes (bite-sized educational content) that capture student attention and deliver meaningful learning moments:

1. **Content Analysis**: Analyze the topic and grade level to identify the most fascinating and educationally valuable aspects
2. **Engagement Strategy**: Craft each BrainByte to spark curiosity, surprise, or wonder while maintaining educational value
3. **Age Appropriateness**: Ensure all content, language, and concepts are perfectly suited for the specified grade level
4. **Variety Creation**: Mix different types of BrainBytes to maintain interest and appeal to different learning preferences
5. **Accuracy Verification**: Ensure all facts, statistics, and information are scientifically accurate and current

## Content Standards
- Each BrainByte should be digestible in 30 seconds or less
- Use vivid, concrete examples that students can visualize
- Include surprising facts or connections that make learning memorable
- Maintain scientific accuracy while being engaging
- Connect to students' everyday experiences when possible
- Use age-appropriate vocabulary with brief explanations for complex terms

## BrainByte Types Guide
- **Fun Facts**: Surprising, verifiable information that amazes students
- **Did You Know?**: Intriguing questions followed by fascinating answers
- **Quick Quiz**: Simple, engaging questions that test understanding
- **Brain Teaser**: Logic puzzles or riddles related to the topic
- **Connection to Today**: How the topic relates to modern life or technology
- **Amazing Stat**: Impressive numbers or comparisons that put things in perspective

# Output Format
Provide your response as a structured JSON object with this exact format:

\`\`\`json
{
  "title": "BrainBytes Collection Title",
  "topic": "Main topic",
  "metadata": {
    "gradeLevel": "Grade level",
    "totalCount": "Number of BrainBytes",
    "format": "Format style",
    "estimatedTime": "Total time to consume all",
    "subject": "Primary subject area"
  },
  "brainBytes": [
    {
      "id": 1,
      "type": "Fun Facts",
      "title": "Catchy title",
      "content": "The actual BrainByte content",
      "emoji": "📚",
      "difficulty": "Easy/Medium/Hard",
      "timeToRead": "15 seconds",
      "tags": ["tag1", "tag2"]
    }
  ],
  "usageTips": [
    "Suggestion for classroom use",
    "Ideas for engagement"
  ]
}
\`\`\`

# Examples

## Example: Grade 4 Ocean BrainBytes
\`\`\`json
{
  "brainBytes": [
    {
      "id": 1,
      "type": "Fun Facts",
      "title": "Ocean Depth Mystery",
      "content": "🌊 Did you know we've explored less than 5% of our oceans? That means there are more mysteries underwater than in outer space! Scientists think there might be creatures down there we've never seen before.",
      "emoji": "🌊",
      "difficulty": "Easy",
      "timeToRead": "20 seconds",
      "tags": ["exploration", "mystery", "ocean"]
    }
  ]
}
\`\`\`

# Final Instructions
Think step by step about what would genuinely fascinate students at this grade level. Create BrainBytes that make learning feel like discovering secrets about the world. Focus on the "wow factor" while maintaining educational integrity.`;

    const userPrompt = `Create BrainBytes for the following specifications:

**Topic**: ${topic}
**Grade Level**: ${gradeLevel}
**Types Requested**: ${Array.isArray(byteTypes) ? byteTypes.join(', ') : 'Fun Facts, Did You Know?'}
**Number of BrainBytes**: ${count || 5}
**Format Style**: ${format || 'Text with Emojis'}

Generate engaging, educational BrainBytes that will captivate students and enhance their learning experience.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    let brainBytesData;
    
    if (jsonMatch) {
      try {
        brainBytesData = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        brainBytesData = null;
      }
    }

    // Generate metadata
    const metadata = {
      subject: brainBytesData?.metadata?.subject || 'General',
      gradeLevel: gradeLevel,
      format: format || 'Text with Emojis',
      count: count || 5,
      generatedAt: new Date().toISOString(),
      wordCount: content.length,
      estimatedTime: brainBytesData?.metadata?.estimatedTime || `${(count || 5) * 2} minutes`,
      difficulty: 'Mixed'
    };

    return NextResponse.json({
      content,
      brainBytesData,
      metadata,
      success: true
    });

  } catch (error) {
    console.error('BrainBytes generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate BrainBytes. Please try again.' },
      { status: 500 }
    );
  }
} 