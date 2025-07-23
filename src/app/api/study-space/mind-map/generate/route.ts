import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate truly unique IDs
const generateUniqueId = (() => {
  let counter = 0;
  return (prefix: string = 'node') => `${prefix}-${Math.random().toString(36).substr(2, 9)}-${++counter}`;
})();

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studyContext, baseClassId } = await request.json();

    if (!studyContext) {
      return NextResponse.json({ error: 'Study context is required' }, { status: 400 });
    }

    // Build context from study materials
    let contextText = '';
    
    // Add selected content (excluding notes)
    if (studyContext.selectedContent && studyContext.selectedContent.length > 0) {
      const contentWithoutNotes = studyContext.selectedContent.filter((item: any) => 
        !item.tags?.includes('note') && item.type !== 'note'
      );
      
      if (contentWithoutNotes.length > 0) {
        contextText += 'SELECTED CONTENT:\n';
        contentWithoutNotes.forEach((item: any, index: number) => {
          contextText += `${index + 1}. ${item.title}\n`;
          if (item.description) contextText += `   Description: ${item.description}\n`;
          
          // Handle different content types
          if (item.content) {
            let contentText = '';
            if (typeof item.content === 'string') {
              contentText = item.content;
            } else if (typeof item.content === 'object') {
              // Handle Tiptap JSON or other object content
              contentText = JSON.stringify(item.content);
            } else {
              contentText = String(item.content);
            }
            contextText += `   Content: ${contentText.substring(0, 500)}...\n`;
          }
          contextText += '\n';
        });
      }
    }

    // Add selected text
    if (studyContext.selectedText) {
      contextText += `HIGHLIGHTED TEXT:\n"${studyContext.selectedText.text}"\nSource: ${studyContext.selectedText.source}\n\n`;
    }

    // Notes are excluded from mind map generation

    if (!contextText.trim()) {
      return NextResponse.json({ error: 'No study content provided' }, { status: 400 });
    }

    const prompt = `You are creating an educational mind map from study materials. Generate a structured, hierarchical mind map that organizes the key concepts and information.

STUDY MATERIALS:
${contextText}

REQUIREMENTS:
1. Create a central topic that captures the main theme
2. Generate 4-6 main branches representing key concepts or themes
3. Each branch should have 2-4 sub-concepts with specific, educational content
4. Use actual facts, definitions, examples, or information - NOT meta-descriptions
5. Make content educational and informative for students
6. Ensure proper hierarchical organization

OUTPUT FORMAT (JSON only):
{
  "center": {
    "label": "Main Topic Title",
    "description": "Brief description of the central concept"
  },
  "branches": [
    {
      "id": "unique_id",
      "label": "Branch Title",
      "description": "Brief description",
      "color": "#DC2626",
      "concepts": [
        {
          "id": "unique_id",
          "label": "Concept Title",
          "description": "Actual educational content, facts, or specific information",
          "points": []
        }
      ]
    }
  ]
}

EXAMPLE OF GOOD vs BAD CONTENT:
❌ BAD: "Photosynthesis Process: Explores how plants convert light to energy"
✅ GOOD: "Photosynthesis Process: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂"

Use these colors in rotation: #DC2626, #059669, #7C3AED, #EA580C, #0891B2, #BE185D, #7C2D12, #1F2937`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert educational mind map designer. Always return valid JSON with the specified structure.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    try {
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      const mindMapData = JSON.parse(cleanedResponse);
      
      // Add unique IDs if not present
      if (mindMapData.branches) {
        mindMapData.branches.forEach((branch: any, branchIndex: number) => {
          if (!branch.id) branch.id = generateUniqueId('branch');
          if (branch.concepts) {
            branch.concepts.forEach((concept: any, conceptIndex: number) => {
              if (!concept.id) concept.id = generateUniqueId(`concept-${branchIndex}`);
            });
          }
        });
      }
      
      return NextResponse.json({
        success: true,
        mindMapData,
        message: `Mind map generated successfully with ${mindMapData.branches?.length || 0} main branches.`
      });
    } catch (parseError) {
      console.error('Failed to parse mind map response:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Failed to generate valid mind map data.',
        details: 'Parse error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Mind map generation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate mind map.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 