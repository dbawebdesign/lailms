import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

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

    const { nodeId, nodeData, currentMindMap, studyContext } = await request.json();

    if (!nodeId || !nodeData || !currentMindMap) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build context from study materials for expansion
    let contextText = '';
    
    if (studyContext?.selectedContent && studyContext.selectedContent.length > 0) {
      contextText += 'AVAILABLE STUDY CONTENT:\n';
      studyContext.selectedContent.forEach((item: any, index: number) => {
        contextText += `${index + 1}. ${item.title}\n`;
        if (item.description) contextText += `   Description: ${item.description}\n`;
        if (item.content) contextText += `   Content: ${item.content.substring(0, 300)}...\n`;
        contextText += '\n';
      });
    }

    if (studyContext?.selectedText) {
      contextText += `HIGHLIGHTED TEXT:\n"${studyContext.selectedText.text}"\n\n`;
    }

    if (studyContext?.currentNotes && studyContext.currentNotes.length > 0) {
      contextText += 'STUDY NOTES:\n';
      studyContext.currentNotes.forEach((note: any, index: number) => {
        contextText += `${index + 1}. ${note.title}\n`;
        if (note.content) contextText += `   ${note.content.substring(0, 200)}...\n`;
        contextText += '\n';
      });
    }

    const expansionPrompt = `You are expanding a study mind map node based on educational content. Generate 2-4 new child nodes with actual educational content, not meta-descriptions.

CURRENT NODE TO EXPAND:
- ID: ${nodeId}
- Label: "${nodeData.label}"
- Description: "${nodeData.description || ''}"
- Current Level: ${nodeData.level}

STUDY CONTEXT:
${contextText}

FULL MIND MAP CONTEXT:
${JSON.stringify(currentMindMap, null, 2)}

EXPANSION REQUIREMENTS:
1. Generate 2-4 child nodes that contain ACTUAL educational content about "${nodeData.label}"
2. Use information from the study materials provided above
3. Provide specific facts, concepts, examples, or information - NOT descriptions of what the content explores
4. Make content educational and factually accurate for students
5. Each node should teach something concrete about the topic
6. Consider the current level (max 6 levels total)
7. Maintain consistency with the overall mind map theme and study materials

EXAMPLE OF GOOD vs BAD CONTENT:
❌ BAD: "Photosynthesis Process: Explores how plants convert light to energy"
✅ GOOD: "Photosynthesis Process: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂"

❌ BAD: "Character Development: Examines how characters grow throughout the story"
✅ GOOD: "Character Development: Protagonist overcomes fear through three key trials, gains confidence, becomes mentor to others"

OUTPUT FORMAT (JSON only):
{
  "expandedNodes": [
    {
      "id": "unique_id",
      "label": "Child Node Title",
      "description": "Actual educational content, facts, or specific information from study materials",
      "color": "${currentMindMap.branches[0]?.color || '#4F46E5'}"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert educational mind map designer. Always return valid JSON with the specified structure. Base expansions on the provided study materials.' 
        },
        { role: 'user', content: expansionPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
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
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Mind map expansion error:', error);
    return NextResponse.json({
      success: false,
      response: 'Failed to expand mind map node.',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 