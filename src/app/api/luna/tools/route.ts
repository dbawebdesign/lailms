import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { Tables } from 'packages/types/db';

import { isTeacher, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify teacher role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_ROLE_FIELDS)
      .eq('user_id', user.id)
      .single<Tables<'profiles'>>();

    if (profileError || !profile) {
      console.error('Profile query error:', profileError);
      return NextResponse.json({ error: 'Access denied. Profile not found.' }, { status: 403 });
    }

    if (!isTeacher(profile)) {
      return NextResponse.json({ error: 'Access denied. Teacher role required.' }, { status: 403 });
    }

    const { toolId, prompt, mode = 'conversational', conversationHistory = [], isRefinement = false, nodeId, currentMindMap, nodeData } = await request.json();

    if (!toolId || !prompt) {
      return NextResponse.json({ error: 'Tool ID and prompt are required' }, { status: 400 });
    }

    // Handle mind map expansion specifically
    if (toolId === 'mindmap-expand') {
      return handleMindMapExpansion(nodeId, nodeData, currentMindMap, prompt);
    }

    // Tool-specific configurations
    const toolConfigs = {
      'rubric-generator': {
        name: 'Rubric Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating assessment rubrics. You help teachers create professional, standards-aligned rubrics through natural conversation.

CONVERSATION APPROACH:
- Start by understanding their basic request
- Ask clarifying questions ONE AT A TIME to gather:
  * Grade level and subject
  * Type of assignment/assessment
  * Specific learning objectives
  * Number of criteria they want (suggest 3-6)
  * Point scale preference (suggest 4-point)
  * Any specific requirements

WHEN YOU HAVE ENOUGH INFORMATION:
- Create a comprehensive rubric with clear criteria
- Use this EXACT format for the final rubric:

**[Rubric Title]**
*Grade Level: [Grade]*
*Subject: [Subject]*

**1. [Criterion Name]**
[Excellent description] | [Proficient description] | [Developing description] | [Beginning description]

**2. [Criterion Name]**
[Excellent description] | [Proficient description] | [Developing description] | [Beginning description]

(Continue for all criteria)

---

### Scoring Guide:
- **Total Points Possible:** [Total]
- **Performance Levels:**
  - **Excellent:** [Point range] points
  - **Proficient:** [Point range] points  
  - **Developing:** [Point range] points
  - **Needs Improvement:** [Point range] points

IMPORTANT: Use the pipe-separated format (|) for performance levels as shown above. This ensures proper parsing and display.`,
        requiresFollowUp: true
      },
      'report-comments': {
        name: 'Report Card Comments Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating personalized report card comments. You help teachers write meaningful, constructive feedback for student progress reports.

CONVERSATION APPROACH:
- Understand the student's performance level and subject area
- Ask about specific strengths and areas for improvement
- Gather context about the grading period and key assignments
- Determine the tone needed (encouraging, constructive, celebratory)

WHEN READY: Generate 2-3 comment options that are:
- Specific and evidence-based
- Balanced (strengths + growth areas)
- Actionable for parents and students
- Age-appropriate for the grade level`,
        requiresFollowUp: true
      },
      'multiple-explanations': {
        name: 'Multiple Explanations Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in differentiated instruction. You help teachers create multiple ways to explain the same concept for diverse learners.

CONVERSATION APPROACH:
- Understand the concept or topic they need to explain
- Ask about their students' grade level and learning preferences
- Determine if they need visual, auditory, kinesthetic, or text-based explanations
- Ask about any specific learning challenges or accommodations needed

WHEN READY: Provide 3-5 different explanation approaches:
- Visual/graphic explanation
- Step-by-step verbal explanation  
- Hands-on/kinesthetic approach
- Real-world analogy or example
- Simplified text version`,
        requiresFollowUp: true
      },
      'iep-generator': {
        name: 'IEP Goals Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating SMART IEP goals. You help teachers and specialists write measurable, achievable goals for students with special needs.

CONVERSATION APPROACH:
- Understand the student's current performance level
- Identify the specific skill or area of need
- Discuss the student's strengths and challenges
- Determine appropriate timeframe and measurement criteria

WHEN READY: Create SMART goals that are:
- Specific and clearly defined
- Measurable with objective criteria
- Achievable based on current level
- Relevant to student needs
- Time-bound with clear deadlines`,
        requiresFollowUp: true
      },
      'lesson-hooks': {
        name: 'Lesson Hook Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating engaging lesson openings. You help teachers design compelling hooks that capture student attention and set the stage for learning.

CONVERSATION APPROACH:
- Understand the lesson topic and learning objectives
- Ask about grade level and student interests
- Determine the lesson format (in-person, virtual, hybrid)
- Ask about available resources and time constraints

WHEN READY: Provide 3-5 different hook options:
- Question-based hooks
- Story or scenario starters
- Multimedia or technology hooks
- Hands-on activity hooks
- Current events connections`,
        requiresFollowUp: true
      },
      'content-leveler': {
        name: 'Content Reading Level Adapter',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in adapting content for different reading levels. You help teachers make content accessible to all learners.

CONVERSATION APPROACH:
- Understand the original content and current reading level
- Ask about target reading level and student needs
- Determine if they need vocabulary support or concept simplification
- Ask about any specific accommodations needed

WHEN READY: Provide adapted versions:
- Simplified vocabulary version
- Shorter sentence structure version
- Visual support suggestions
- Key concept highlights
- Scaffolded reading supports`,
        requiresFollowUp: true
      },
      'mindmap-generator': {
        name: 'Mind Map Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating visual mind maps for learning. You help teachers design structured, hierarchical mind maps that organize information clearly.

CONVERSATION APPROACH:
- Understand the topic or concept they want to map
- Ask about the grade level and complexity needed
- Determine the main theme and key subtopics
- Ask about specific learning objectives or focus areas
- Find out if they need it for introduction, review, or assessment

WHEN READY: Create a structured mind map using this EXACT format:

# Mind Map: [Topic Title]

## Central Theme: [Main Topic]

### Branch 1: [Subtopic Name]
- [Detail/concept]
- [Detail/concept]
- [Detail/concept]

### Branch 2: [Subtopic Name]
- [Detail/concept]
- [Detail/concept]
- [Detail/concept]

### Branch 3: [Subtopic Name]
- [Detail/concept]
- [Detail/concept]
- [Detail/concept]

(Continue for all branches)

---

**Teaching Notes:**
- **Grade Level:** [Grade level]
- **Subject:** [Subject area]
- **Use Cases:** [How to use this mind map]
- **Extensions:** [Ideas for expanding the map]

IMPORTANT: Use the hierarchical structure with ### for main branches and - for details. This ensures proper parsing and visual display.`,
        requiresFollowUp: true
      },
      'brain-bytes': {
        name: 'Brain Bytes Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating bite-sized learning content. You help teachers break down complex topics into digestible "brain bytes" for better comprehension.

CONVERSATION APPROACH:
- Understand the complex topic or concept they want to break down
- Ask about the grade level and attention span considerations
- Determine how many bytes they need (suggest 3-7)
- Ask about the learning context (review, introduction, reinforcement)
- Find out preferred format (facts, questions, activities, etc.)

WHEN READY: Create brain bytes using this EXACT format:

# Brain Bytes: [Topic Title]

## Byte 1: [Subtopic Name]
**Key Concept:** [Main idea in one sentence]
**Details:** [2-3 supporting details or examples]
**Memory Hook:** [Mnemonic, analogy, or memorable connection]

## Byte 2: [Subtopic Name]
**Key Concept:** [Main idea in one sentence]
**Details:** [2-3 supporting details or examples]
**Memory Hook:** [Mnemonic, analogy, or memorable connection]

(Continue for all bytes)

---

**Teaching Tips:**
- **Grade Level:** [Grade level]
- **Timing:** [Suggested time per byte]
- **Sequence:** [Recommended order of delivery]
- **Assessment Ideas:** [Quick check suggestions]

IMPORTANT: Keep each byte focused and concise. Use the exact format shown above for proper parsing.`,
        requiresFollowUp: true
      }
    };

    const config = toolConfigs[toolId as keyof typeof toolConfigs];
    if (!config) {
      return NextResponse.json({ error: 'Invalid tool ID' }, { status: 400 });
    }

    // Build conversation context
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: config.systemPrompt
      }
    ];

    // Add conversation history
    conversationHistory.forEach((msg: any) => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response generated');
    }

    // Determine if this is a final result or needs follow-up
    const isComplete = 
      // Check for rubric indicators
      (response.includes('**1.') && response.includes('|')) ||
      response.includes('### Scoring Guide:') ||
      // Check for completion phrases
      response.toLowerCase().includes('here are your') ||
      response.toLowerCase().includes('here\'s your') ||
      response.toLowerCase().includes('here are the') ||
      response.toLowerCase().includes('here\'s the') ||
      // Check for multi-option outputs
      (response.toLowerCase().includes('option 1') && response.toLowerCase().includes('option 2')) ||
      // Check for structured output patterns
      response.includes('**Option') ||
      response.includes('**Version') ||
      // Check for final deliverable indicators
      response.toLowerCase().includes('final version') ||
      response.toLowerCase().includes('completed') ||
      // Tool-specific completion indicators
      (toolId === 'multiple-explanations' && response.includes('**Explanation')) ||
      (toolId === 'report-comments' && response.toLowerCase().includes('comment option')) ||
      (toolId === 'lesson-hooks' && response.toLowerCase().includes('hook option')) ||
      (toolId === 'content-leveler' && response.toLowerCase().includes('adapted version')) ||
      (toolId === 'iep-generator' && response.toLowerCase().includes('goal')) ||
      (toolId === 'mindmap-generator' && (response.includes('### Branch') || response.includes('## Central Theme:'))) ||
      (toolId === 'brain-bytes' && response.includes('## Byte'));

    return NextResponse.json({
      response,
      isComplete,
      toolId,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response }
      ]
    });

  } catch (error) {
    console.error('Luna tools API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function handleMindMapExpansion(nodeId: string, nodeData: any, currentMindMap: any, prompt: string) {
  try {
    const expansionPrompt = `You are expanding an educational mind map node. Generate 2-4 new child nodes with actual educational content, not meta-descriptions.

CURRENT NODE TO EXPAND:
- ID: ${nodeId}
- Label: "${nodeData.label}"
- Description: "${nodeData.description || ''}"
- Current Level: ${nodeData.level}
- Parent Context: ${nodeData.parentContext || 'none'}

FULL MIND MAP CONTEXT:
${JSON.stringify(currentMindMap, null, 2)}

EXPANSION REQUIREMENTS:
1. Generate 2-4 child nodes that contain ACTUAL educational content about "${nodeData.label}"
2. Provide specific facts, concepts, examples, or information - NOT descriptions of what the content explores
3. Make content grade-appropriate and factually accurate
4. Each node should teach something concrete about the topic
5. Consider the current level (max 6 levels total)
6. Maintain consistency with the overall mind map theme

EXAMPLE OF GOOD vs BAD CONTENT:
❌ BAD: "Christian's Transformation: Growth in Faith - Explores how Christian's faith evolves throughout his journey"
✅ GOOD: "Christian's Transformation: Begins as fearful doubter, gains courage through trials, ends as confident believer"

❌ BAD: "Photosynthesis Process: Examines how plants convert light to energy"
✅ GOOD: "Photosynthesis Process: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂"

OUTPUT FORMAT (JSON only):
{
  "expandedNodes": [
    {
      "id": "unique_id",
      "label": "Child Node Title",
      "description": "Actual educational content, facts, or specific information",
      "color": "${currentMindMap.branches[0]?.color || '#4F46E5'}"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert educational mind map designer. Always return valid JSON with the specified structure.' 
        },
        { role: 'user', content: expansionPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Try to parse the JSON response
    try {
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      const expandedData = JSON.parse(cleanedResponse);
      
      return NextResponse.json({
        success: true,
        nodeId,
        expandedNodes: expandedData.expandedNodes || [],
        response: `Successfully expanded "${nodeData.label}" with ${expandedData.expandedNodes?.length || 0} new nodes.`
      });
    } catch (parseError) {
      console.error('Failed to parse expansion response:', parseError);
      return NextResponse.json({
        success: false,
        response: 'Failed to generate valid expansion data.',
        error: 'Parse error'
      });
    }

  } catch (error) {
    console.error('Mind map expansion error:', error);
    return NextResponse.json({
      success: false,
      response: 'Failed to expand mind map node.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 