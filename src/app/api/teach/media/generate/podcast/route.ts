import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PodcastRequest {
  lessonId: string;
  content?: string; // Optional fallback content
  gradeLevel: string;
}

const LUNA_VOICE_ID = 'alloy'; // Consistent voice for Luna across all podcasts

// Helper function to extract text from JSONB content
function extractTextFromContent(content: any): string {
  if (!content) return '';
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (typeof content === 'object') {
    // Handle Tiptap/ProseMirror JSON structure
    if (content.type === 'doc' && content.content) {
      return extractTextFromNodes(content.content);
    }
    
    // Handle other JSON structures
    if (Array.isArray(content)) {
      return content.map(item => extractTextFromContent(item)).join(' ');
    }
    
    // Extract text from object properties
    const textValues = Object.values(content)
      .filter(value => typeof value === 'string')
      .join(' ');
    
    if (textValues) return textValues;
    
    // Recursively search nested objects
    return Object.values(content)
      .map(value => extractTextFromContent(value))
      .filter(text => text)
      .join(' ');
  }
  
  return String(content);
}

function extractTextFromNodes(nodes: any[]): string {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.type === 'text') {
      return node.text || '';
    }
    
    if (node.type === 'paragraph' && node.content) {
      return extractTextFromNodes(node.content) + '\n\n';
    }
    
    if (node.type === 'heading' && node.content) {
      return extractTextFromNodes(node.content) + '\n\n';
    }
    
    if (node.type === 'bulletList' && node.content) {
      return node.content.map((item: any) => 
        '• ' + extractTextFromNodes(item.content || [])
      ).join('\n') + '\n\n';
    }
    
    if (node.type === 'orderedList' && node.content) {
      return node.content.map((item: any, index: number) => 
        `${index + 1}. ` + extractTextFromNodes(item.content || [])
      ).join('\n') + '\n\n';
    }
    
    if (node.content) {
      return extractTextFromNodes(node.content);
    }
    
    return '';
  }).join('');
}

export async function POST(request: NextRequest) {
  try {
    const { lessonId, content: fallbackContent, gradeLevel }: PodcastRequest = await request.json();

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseServerClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if regeneration is requested
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';
    
    // Check if a podcast already exists for this lesson
    const { data: existingAssets } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('asset_type', 'podcast')
      .eq('status', 'completed');

    if (existingAssets && existingAssets.length > 0 && !regenerate) {
      return NextResponse.json(
        { error: 'A Brain Bytes podcast already exists for this lesson' },
        { status: 409 }
      );
    }

    // If regenerating, delete existing podcasts first
    if (regenerate && existingAssets && existingAssets.length > 0) {
      // Delete old audio files from storage
      for (const asset of existingAssets) {
        if ((asset as any).file_path) {
          const { error: storageError } = await supabase.storage
            .from('lesson-media')
            .remove([(asset as any).file_path]);
          
          if (storageError) {
            console.warn('Failed to delete old audio file:', storageError);
          }
        }
      }

      // Delete database records
      const { error: deleteError } = await supabase
        .from('lesson_media_assets')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('asset_type', 'podcast');

      if (deleteError) {
        console.error('Failed to delete existing podcast:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete existing podcast' },
          { status: 500 }
        );
      }
    }

    // Fetch lesson details and all its sections
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('title, description')
      .eq('id', lessonId)
      .single<Tables<"lessons">>();

    if (lessonError) {
      console.error('Failed to fetch lesson:', lessonError);
      return NextResponse.json(
        { error: 'Failed to fetch lesson details' },
        { status: 500 }
      );
    }

    // Fetch all lesson sections for this lesson
    const { data: sections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('title, content, section_type, order_index')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });

    if (sectionsError) {
      console.error('Failed to fetch lesson sections:', sectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch lesson sections' },
        { status: 500 }
      );
    }

    // Build comprehensive content from lesson and all sections
    let comprehensiveContent = '';

    // Add lesson title and description
    if (lesson && lesson.title) {
      comprehensiveContent += `Lesson Title: ${lesson.title}\n\n`;
    }
    if (lesson && lesson.description) {
      comprehensiveContent += `Lesson Description: ${lesson.description}\n\n`;
    }

    // Add all section content
    if (sections && sections.length > 0) {
      comprehensiveContent += 'Lesson Content:\n\n';
      
      sections.forEach((section, index) => {
        comprehensiveContent += `Section ${index + 1}: ${(section as any).title}\n`;
        
        // Extract text content from JSONB
        const sectionText = extractTextFromContent((section as any).content);
        if (sectionText.trim()) {
          comprehensiveContent += `${sectionText}\n\n`;
        }
      });
    } else if (fallbackContent) {
      // Use fallback content if no sections are available
      comprehensiveContent += `Content: ${fallbackContent}\n\n`;
    }

    if (!comprehensiveContent.trim()) {
      return NextResponse.json(
        { error: 'No content available to generate podcast' },
        { status: 400 }
      );
    }

    // Generate podcast script using OpenAI
    const scriptPrompt = `# Role and Objective
Create an engaging educational podcast script for "Brain Bytes" hosted by Luna. The content should be appropriate for grade ${gradeLevel} students and should teach the main concepts from the provided lesson.

# Content Context
${comprehensiveContent}

# Instructions

## Host Character
- **Name**: Luna (friendly, knowledgeable, encouraging AI)
- **Personality**: Enthusiastic about learning, supportive, excellent at explaining complex concepts in simple terms
- **Goal**: Make learning feel accessible and fun

## Content Requirements
1. **Educational Focus**: Actually teach the concepts, don't just mention them
2. **Grade Appropriateness**: Content must be suitable for grade ${gradeLevel} students
3. **Comprehensive Coverage**: Cover the main points from all the lesson sections provided
4. **Logical Flow**: Create a natural flow between the different topics/sections
5. **Engagement**: Include examples and analogies that students at this grade level would understand
6. **Concept Breakdown**: Break down complex concepts into digestible parts
7. **Encouraging Language**: Use encouraging language throughout

## Format Requirements
- **Length**: Aim for 3-4 minutes of spoken content
- **Character Limit**: MAXIMUM 3500 characters total (critical for TTS compatibility)
- **Structure**: Follow the provided script format exactly

## Script Format
[INTRO MUSIC - 5 seconds]

LUNA: Welcome to Brain Bytes, where we explore amazing ideas in bite-sized pieces! I'm Luna, and today we're diving into [lesson topic]. 

[Continue with main content sections, teaching key concepts clearly from all provided sections - keep this section concise but informative]

[OUTRO]

LUNA: That's a wrap on today's Brain Bytes! Remember, learning is an adventure, and every concept you master today builds the foundation for tomorrow's discoveries. Keep being curious, and I'll see you next time!

[OUTRO MUSIC - 3 seconds]

# Output Requirements
- Return only the script text, no additional formatting or comments
- Keep the total length under 3500 characters
- Ensure all key concepts from the lesson are covered
- Maintain Luna's encouraging and educational tone throughout`;

    const scriptCompletion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `# Role and Objective
You are Luna, an AI educational podcast host who creates engaging, grade-appropriate content for the "Brain Bytes" podcast.

# Instructions
- You're enthusiastic about learning, supportive, and excellent at explaining complex concepts in simple terms
- Always make learning feel accessible and fun
- Focus on actually teaching concepts, not just mentioning them
- Keep content appropriate for the specified grade level
- Maintain an encouraging and educational tone throughout
- CRITICAL: Stay within the 3500 character limit for TTS compatibility`
        },
        {
          role: 'user',
          content: scriptPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const script = scriptCompletion.choices[0]?.message?.content;
    if (!script) {
      throw new Error('Failed to generate podcast script');
    }

    // Clean up script for TTS (remove stage directions and music cues)
    let cleanScript = script
      .replace(/\[.*?\]/g, '') // Remove [INTRO MUSIC], [OUTRO MUSIC], etc.
      .replace(/LUNA:/g, '') // Remove speaker labels
      .replace(/\n\n+/g, '\n\n') // Normalize line breaks
      .trim();

    // Ensure script is within TTS character limit (4096 characters)
    if (cleanScript.length > 4096) {
      console.log(`Script too long (${cleanScript.length} chars), truncating to 4096 characters`);
      // Find a good truncation point (end of sentence near the limit)
      const truncateAt = cleanScript.lastIndexOf('.', 4050);
      if (truncateAt > 3500) {
        cleanScript = cleanScript.substring(0, truncateAt + 1);
      } else {
        // Fallback: hard truncate at 4090 chars and add period
        cleanScript = cleanScript.substring(0, 4090) + '.';
      }
    }

    // Generate audio using OpenAI TTS
    const audioResponse = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: LUNA_VOICE_ID,
      input: cleanScript,
      speed: 1.0,
    });

    if (!audioResponse.ok) {
      throw new Error('Failed to generate audio');
    }

    // Convert audio to buffer
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    
    // Calculate estimated duration (rough estimate: ~150 words per minute)
    const wordCount = cleanScript.split(/\s+/).length;
    const estimatedDuration = Math.round((wordCount / 150) * 60); // in seconds

    // Upload audio to Supabase Storage
    const fileName = `podcast_${lessonId}_${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lesson-media')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // Get public URL for the audio file
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-media')
      .getPublicUrl(fileName);

    // Save the podcast asset to the database
    const { data: assetData, error: assetError } = await supabase
      .from('lesson_media_assets')
      .insert({
        lesson_id: lessonId,
        asset_type: 'podcast',
        title: 'Brain Bytes Podcast',
        content: {
          script: script,
          clean_script: cleanScript,
          voice: LUNA_VOICE_ID,
          word_count: wordCount,
          sections_count: sections?.length || 0,
          comprehensive_content_length: comprehensiveContent.length
        },
        file_url: publicUrl,
        file_path: fileName,
        duration: estimatedDuration,
        status: 'completed',
        created_by: user.id
      })
      .select()
      .single<Tables<"lesson_media_assets">>();

    if (assetError) {
      console.error('Database error:', assetError);
      throw new Error('Failed to save podcast');
    }

    return NextResponse.json({
      success: true,
      asset: {
        id: assetData!.id,
        type: 'podcast',
        title: assetData!.title,
        url: publicUrl,
        duration: estimatedDuration,
        status: 'completed',
        createdAt: assetData!.created_at
      }
    });

  } catch (error) {
    console.error('Podcast generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Brain Bytes podcast. Please try again.' },
      { status: 500 }
    );
  }
} 