import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from "packages/types/db";
import { isTeacher, PROFILE_ROLE_FIELDS } from '@/lib/utils/roleUtils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TeacherBrainBytesRequest {
  topic: string;
  gradeLevel: string;
}

const LUNA_VOICE_ID = 'alloy'; // Consistent voice for Luna across all podcasts

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

    const { topic, gradeLevel }: TeacherBrainBytesRequest = await request.json();

    // Validate required fields
    if (!topic || !gradeLevel) {
      return NextResponse.json({ 
        error: 'Missing required fields: topic and gradeLevel are required' 
      }, { status: 400 });
    }

    // Generate podcast script using OpenAI
    const scriptPrompt = `# Role and Objective
Create an engaging educational podcast script for "Brain Bytes" hosted by Luna. The content should be appropriate for grade ${gradeLevel} students and should teach about ${topic}.

# Content Context
Topic: ${topic}
Grade Level: ${gradeLevel}

# Instructions

## Host Character
- **Name**: Luna (friendly, knowledgeable, encouraging AI)
- **Personality**: Enthusiastic about learning, supportive, excellent at explaining complex concepts in simple terms
- **Goal**: Make learning feel accessible and fun

## Content Requirements
1. **Educational Focus**: Actually teach about the topic, don't just mention it
2. **Grade Appropriateness**: Content must be suitable for grade ${gradeLevel} students
3. **Engagement**: Include examples and analogies that students at this grade level would understand
4. **Concept Breakdown**: Break down complex concepts into digestible parts
5. **Encouraging Language**: Use encouraging language throughout
6. **Standalone Content**: This should be complete on its own, not tied to any specific lesson

## Format Requirements
- **Length**: Aim for 2-3 minutes of spoken content
- **Character Limit**: MAXIMUM 2500 characters total (critical for TTS compatibility)
- **Structure**: Follow the provided script format exactly

## Script Format
[INTRO MUSIC - 5 seconds]

LUNA: Welcome to Brain Bytes, where we explore amazing ideas in bite-sized pieces! I'm Luna, and today we're diving into ${topic}. 

[Continue with main content about the topic, teaching key concepts clearly - keep this section concise but informative]

[OUTRO]

LUNA: That's a wrap on today's Brain Bytes! Remember, learning is an adventure, and every concept you master today builds the foundation for tomorrow's discoveries. Keep being curious, and I'll see you next time!

[OUTRO MUSIC - 3 seconds]

# Output Requirements
- Return only the script text, no additional formatting or comments
- Keep the total length under 2500 characters
- Ensure the content is educational and engaging for grade ${gradeLevel} students
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
- CRITICAL: Stay within the 2500 character limit for TTS compatibility`
        },
        {
          role: 'user',
          content: scriptPrompt
        }
      ],
      max_tokens: 1500,
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

    // Generate audio using OpenAI TTS
    const audioResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: LUNA_VOICE_ID,
      input: cleanScript,
      speed: 1.0,
    });

    // Convert audio to buffer
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    
    // Calculate estimated duration (rough estimate: ~150 words per minute)
    const wordCount = cleanScript.split(/\s+/).length;
    const estimatedDuration = Math.round((wordCount / 150) * 60); // in seconds

    // Upload audio to Supabase Storage
    const fileName = `brainbytes_${Date.now()}.mp3`;
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

    // Generate metadata
    const metadata = {
      topic: topic,
      gradeLevel: gradeLevel,
      duration: estimatedDuration,
      generatedAt: new Date().toISOString(),
      wordCount: wordCount,
      scriptLength: cleanScript.length,
      voice: LUNA_VOICE_ID
    };

    return NextResponse.json({
      success: true,
      content: {
        script: script,
        cleanScript: cleanScript,
        audioUrl: publicUrl,
        fileName: fileName,
        duration: estimatedDuration,
        title: `Brain Bytes: ${topic}`,
        metadata: metadata
      }
    });

  } catch (error) {
    console.error('BrainBytes podcast generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate BrainBytes podcast. Please try again.' },
      { status: 500 }
    );
  }
} 