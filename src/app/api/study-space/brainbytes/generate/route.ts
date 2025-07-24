import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface StudySpaceBrainbytesRequest {
  studyContext: {
    selectedContent: any[];
    selectedText?: {
      text: string;
      source: string;
    };
  };
  baseClassId?: string;
  studySpaceId?: string;
  instructions?: string;
  gradeLevel?: string;
}

const LUNA_VOICE_ID = 'shimmer'; // Consistent voice for Luna across all podcasts

// Helper function to extract text from various content formats
function extractTextFromContent(content: any): string {
  if (!content) return '';
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (content.text) {
    return content.text;
  }
  
  if (content.content) {
    if (typeof content.content === 'string') {
      return content.content;
    }
    if (Array.isArray(content.content)) {
      return content.content.map((item: any) => extractTextFromContent(item)).join(' ');
    }
  }
  
  if (content.children && Array.isArray(content.children)) {
    return content.children.map((child: any) => extractTextFromContent(child)).join(' ');
  }
  
  return '';
}

function buildContentContext(studyContext: any): string {
  let context = '';
  
  // Add selected content
  if (studyContext.selectedContent && studyContext.selectedContent.length > 0) {
    context += "Selected Source Materials:\n";
    studyContext.selectedContent.forEach((content: any, index: number) => {
      const text = extractTextFromContent(content);
      if (text.trim()) {
        context += `Source ${index + 1}: ${text.trim()}\n\n`;
      }
    });
  }
  
  // Add specifically selected text
  if (studyContext.selectedText && studyContext.selectedText.text) {
    context += `Selected Text from ${studyContext.selectedText.source}:\n${studyContext.selectedText.text}\n\n`;
  }
  
  return context;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: StudySpaceBrainbytesRequest = await request.json();
    const { studyContext, baseClassId, studySpaceId, instructions, gradeLevel } = body;

    // Build content context from selected sources
    const contentContext = buildContentContext(studyContext);
    
    if (!contentContext.trim()) {
      return NextResponse.json({ 
        error: 'No content selected. Please select some source material to create a Brainbytes podcast.' 
      }, { status: 400 });
    }

    // Get course/class information for context
    let courseContext = '';
    if (baseClassId) {
      const { data: baseClass } = await supabase
        .from('base_classes')
        .select('name, description')
        .eq('id', baseClassId)
        .single();
      
      if (baseClass) {
        courseContext = `
Course: ${baseClass.name}
Grade Level: ${gradeLevel || 'Not specified'}
Description: ${baseClass.description || ''}
        `;
      }
    }

    // Generate script using AI
    const scriptPrompt = `
You are Luna, an AI tutor creating an educational Brainbytes podcast. Create a conversational, engaging 3-minute educational podcast script based on the provided content.

${courseContext}

Content to Cover:
${contentContext}

${instructions ? `Special Instructions: ${instructions}` : ''}

Guidelines:
- Keep it exactly 3 minutes long (approximately 450-500 words)
- Make it educational and engaging for the specified grade level
- Use a conversational, friendly tone as Luna
- Focus on the key concepts and make them easy to understand
- Include concrete examples and analogies when helpful
- Structure it with a clear introduction, main content, and conclusion
- Make it sound natural when spoken aloud

Format the response as a single cohesive script for Luna to speak. Do not include any speaker labels or formatting - just the raw text that will be converted to speech.
    `;

    const scriptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Luna, an AI tutor who creates engaging educational content. Generate natural, conversational scripts for audio podcasts.'
        },
        {
          role: 'user',
          content: scriptPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const script = scriptResponse.choices[0]?.message?.content;
    if (!script) {
      throw new Error('Failed to generate podcast script');
    }

    // Convert script to audio using TTS
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: LUNA_VOICE_ID,
      input: script,
      response_format: 'mp3',
    });

    // Get audio buffer
    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    
    // Generate unique filename with user folder structure (required for RLS policies)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `brainbytes-${timestamp}.mp3`;
    const filePath = `${user.id}/${filename}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brainbytes-audio')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('brainbytes-audio')
      .getPublicUrl(filePath);

    // Save record to database using study_space_brainbytes table
    const { data: brainbytesRecord, error: dbError } = await (supabase as any)
      .from('study_space_brainbytes')
      .insert({
        user_id: user.id,
        base_class_id: baseClassId || null,
        study_space_id: studySpaceId || null,
        title: 'Brainbytes Podcast',
        script: script,
        audio_url: publicUrl,
        instructions: instructions || null,
        content_context: contentContext,
        duration_minutes: 3,
        status: 'completed'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't throw here - the audio was created successfully
    }

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      script: script,
      id: brainbytesRecord?.id,
      message: 'Brainbytes podcast generated successfully!'
    });

  } catch (error) {
    console.error('Error generating Brainbytes:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate Brainbytes podcast',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 