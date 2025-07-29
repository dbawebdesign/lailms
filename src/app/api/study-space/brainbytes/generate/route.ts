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

// Content processing functions (following mind map approach)

function buildContentContext(studyContext: any): string {
  let context = '';
  
  // Add selected content (filter out notes like mind map does)
  if (studyContext.selectedContent && studyContext.selectedContent.length > 0) {
    const contentWithoutNotes = studyContext.selectedContent.filter((item: any) => 
      !item.tags?.includes('note') && item.type !== 'note'
    );
    
    if (contentWithoutNotes.length > 0) {
      context += 'SELECTED STUDY MATERIALS:\n';
      contentWithoutNotes.forEach((item: any, index: number) => {
        context += `${index + 1}. ${item.title || 'Untitled Content'}\n`;
        
        if (item.description) {
          context += `   Description: ${item.description}\n`;
        }
        
        // Handle different content types like mind map does
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
          
          // Include substantial content for comprehensive podcast generation
          const truncatedContent = contentText.length > 10000 ? 
            contentText.substring(0, 10000) + '...' : contentText;
          context += `   Content: ${truncatedContent}\n`;
        }
        
        context += '\n';
      });
    }
  }
  
  // Add specifically selected text (prioritize this like mind map does)
  if (studyContext.selectedText && studyContext.selectedText.text) {
    context += `HIGHLIGHTED TEXT:\n"${studyContext.selectedText.text}"\nSource: ${studyContext.selectedText.source}\n\n`;
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

    // First, generate a title for the podcast based on main topic
    const titlePrompt = `
Based on the following selected study materials, create a short, focused podcast title (maximum 8 words) that captures the MAIN TOPIC or central concept being studied:

${contentContext}

${instructions ? `Focus: ${instructions}` : ''}

REQUIREMENTS:
- Focus on the primary subject matter or main concept from the content
- Make it educational and specific to what's being taught
- Avoid generic terms like "Study Guide" or "Educational Content"
- Capture the essence of what students will learn about

Example good titles: "Understanding Photosynthesis Process", "World War II Causes", "Quadratic Equations Explained"
    `;

    const titleResponse = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise, educational podcast titles.'
        },
        {
          role: 'user',
          content: titlePrompt
        }
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const podcastTitle = titleResponse.choices[0]?.message?.content?.replace(/['"]/g, '').trim() || 'Brainbytes Podcast';

    // Generate script using AI with emphasis on selected content
    const scriptPrompt = `
You are Luna, an AI tutor creating an educational Brainbytes podcast. Create a conversational, engaging 3-minute educational podcast script.

IMPORTANT: Base your content EXCLUSIVELY on the selected source material below. Do not add general course information beyond what's provided in the selected content.

${courseContext}

SELECTED SOURCE MATERIAL (This is your PRIMARY focus):
${contentContext}

${instructions ? `Special Instructions: ${instructions}` : ''}

Guidelines:
- Keep it exactly 3 minutes long (approximately 450-500 words)
- Focus ONLY on concepts, examples, and information from the selected source material above
- Use a conversational, friendly tone as Luna
- Explain the specific concepts from the selected content clearly
- Use examples and analogies directly related to the selected material
- Structure: brief intro → dive deep into the selected content → practical conclusion
- Make it sound natural when spoken aloud
- Stay focused on the selected material - do not generalize to broader course topics

Format the response as a single cohesive script for Luna to speak. Do not include any speaker labels or formatting - just the raw text that will be converted to speech.
    `;

    const scriptResponse = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
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

    // Clean up script for TTS and ensure character limit
    let cleanScript = script
      .replace(/\[.*?\]/g, '') // Remove any stage directions
      .replace(/LUNA:/g, '') // Remove speaker labels
      .replace(/\n\n+/g, '\n\n') // Normalize line breaks
      .trim();

    // Ensure script is within TTS character limit (4096 characters)
    if (cleanScript.length > 4096) {
      console.log(`Script too long (${cleanScript.length} chars), truncating to 4096 characters`);
      
      // First try to find a good truncation point (end of sentence near the limit)
      let truncateAt = cleanScript.lastIndexOf('.', 4050);
      
      // If no good sentence break found, try other punctuation
      if (truncateAt <= 3000) {
        truncateAt = cleanScript.lastIndexOf('!', 4050);
      }
      if (truncateAt <= 3000) {
        truncateAt = cleanScript.lastIndexOf('?', 4050);
      }
      if (truncateAt <= 3000) {
        truncateAt = cleanScript.lastIndexOf(',', 4050);
      }
      
      // If still no good break point, hard truncate
      if (truncateAt > 3000) {
        cleanScript = cleanScript.substring(0, truncateAt + 1);
      } else {
        // Fallback: hard truncate at 4090 chars and add period
        cleanScript = cleanScript.substring(0, 4090) + '.';
      }
      
      console.log(`Script truncated to ${cleanScript.length} characters`);
    }

    // Double-check the final length before sending to TTS
    if (cleanScript.length > 4096) {
      console.error(`Script still too long after truncation: ${cleanScript.length} characters`);
      // Final emergency truncation
      cleanScript = cleanScript.substring(0, 4090) + '.';
      console.log(`Emergency truncation to ${cleanScript.length} characters`);
    }

    // Convert script to audio using TTS (explicitly using shimmer voice)
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',  // Explicitly set to shimmer
      input: cleanScript,
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
        title: podcastTitle,
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
      title: podcastTitle,
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