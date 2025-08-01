import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Tables } from "packages/types/db";

interface BrainbytesOptions {
  regenerate?: boolean;
  internal?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  gradeLevel?: string;
}

interface BrainbytesResult {
  success: boolean;
  asset?: any;
  error?: string;
}

const LUNA_VOICE_ID = 'alloy'; // Consistent voice for Luna across all podcasts

class BrainbytesGenerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate brainbytes podcast for a lesson
   */
  async generateLessonBrainbytes(
    supabase: any,
    lessonId: string,
    user: any,
    options: BrainbytesOptions = {}
  ): Promise<BrainbytesResult> {
    const {
      regenerate = false,
      internal = false,
      maxRetries = 3,
      retryDelay = 2000,
      gradeLevel = 'middle_school'
    } = options;

    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`🎧 [BrainbytesService] Attempt ${retryCount + 1}/${maxRetries} - Generating brainbytes for lesson: ${lessonId}`);

        // Check if a podcast already exists for this lesson
        const { data: existingAssets } = await supabase
          .from('lesson_media_assets')
          .select('*')
          .eq('lesson_id', lessonId)
          .eq('asset_type', 'podcast')
          .eq('status', 'completed');

        if (existingAssets && existingAssets.length > 0 && !regenerate) {
          return {
            success: false,
            error: 'A Brain Bytes podcast already exists for this lesson'
          };
        }

        // If regenerating, delete existing podcasts first
        if (regenerate && existingAssets && existingAssets.length > 0) {
          await this.deleteExistingPodcasts(supabase, lessonId, existingAssets);
        }

        // Fetch lesson and sections content
        const contentResult = await this.fetchLessonContent(supabase, lessonId);
        if (!contentResult.success) {
          if (contentResult.error?.includes('Lesson not found') && retryCount < maxRetries - 1) {
            retryCount++;
            console.log(`🎧 [BrainbytesService] Lesson not found, retrying in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          return contentResult;
        }

        const { comprehensiveContent } = contentResult;

        // Generate podcast script using OpenAI
        const script = await this.generatePodcastScript(comprehensiveContent, gradeLevel);

        // Clean up script for TTS
        const cleanScript = this.cleanScriptForTTS(script);

        // Generate audio using OpenAI TTS
        const audioBuffer = await this.generateAudio(cleanScript);

        // Upload and save to database
        const asset = await this.saveAudioAsset(
          supabase,
          lessonId,
          user.id,
          audioBuffer,
          script,
          cleanScript,
          comprehensiveContent
        );

        console.log(`✅ [BrainbytesService] Successfully created brainbytes for lesson: ${lessonId}`);
        return {
          success: true,
          asset
        };

      } catch (error) {
        retryCount++;
        console.error(`🎧 [BrainbytesService] Failed attempt ${retryCount}/${maxRetries} for brainbytes generation:`, error);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ [BrainbytesService] Failed to generate brainbytes for lesson ${lessonId} after ${maxRetries} attempts:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded'
    };
  }

  /**
   * Delete existing podcast assets
   */
  private async deleteExistingPodcasts(supabase: any, lessonId: string, existingAssets: any[]): Promise<void> {
    // Delete old audio files from storage
    for (const asset of existingAssets) {
      if (asset.file_path) {
        const { error: storageError } = await supabase.storage
          .from('lesson-media')
          .remove([asset.file_path]);
        
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
      throw new Error('Failed to delete existing podcast');
    }
  }

  /**
   * Fetch lesson and sections content
   */
  private async fetchLessonContent(supabase: any, lessonId: string): Promise<{ success: boolean; comprehensiveContent?: string; error?: string }> {
    // Fetch lesson details
    console.log('🔍 [BrainbytesService] Fetching lesson for brainbytes:', lessonId);
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('title, description')
      .eq('id', lessonId)
      .single<Tables<"lessons">>();

    console.log('📊 [BrainbytesService] Lesson query result:', { lesson: !!lesson, error: lessonError });

    if (lessonError) {
      console.error('❌ [BrainbytesService] Failed to fetch lesson:', { lessonId, error: lessonError });
      return {
        success: false,
        error: 'Lesson not found'
      };
    }

    // Fetch all lesson sections
    const { data: sections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('title, content, section_type, order_index')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });

    if (sectionsError) {
      console.error('[BrainbytesService] Failed to fetch lesson sections:', sectionsError);
      return {
        success: false,
        error: 'Failed to fetch lesson sections'
      };
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
        const sectionText = this.extractTextFromContent((section as any).content);
        if (sectionText.trim()) {
          comprehensiveContent += `${sectionText}\n\n`;
        }
      });
    }

    if (!comprehensiveContent.trim()) {
      return {
        success: false,
        error: 'No content available to generate podcast'
      };
    }

    return {
      success: true,
      comprehensiveContent
    };
  }

  /**
   * Generate podcast script using OpenAI
   */
  private async generatePodcastScript(comprehensiveContent: string, gradeLevel: string): Promise<string> {
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
- **Length**: Aim for 2-3 minutes of spoken content (shorter is better)
- **Character Limit**: MAXIMUM 2500 characters total (critical for TTS compatibility)
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
- Keep the total length under 2500 characters
- Ensure all key concepts from the lesson are covered
- Maintain Luna's encouraging and educational tone throughout`;

    const scriptCompletion = await this.openai.chat.completions.create({
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

    return script;
  }

  /**
   * Clean up script for TTS (remove stage directions and music cues)
   */
  private cleanScriptForTTS(script: string): string {
    let cleanScript = script
      .replace(/\[.*?\]/g, '') // Remove [INTRO MUSIC], [OUTRO MUSIC], etc.
      .replace(/LUNA:/g, '') // Remove speaker labels
      .replace(/\n\n+/g, '\n\n') // Normalize line breaks
      .trim();

    // Ensure script is within TTS character limit (4096 characters)
    if (cleanScript.length > 4096) {
      console.log(`[BrainbytesService] Script too long (${cleanScript.length} chars), truncating to 4096 characters`);
      
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
      
      console.log(`[BrainbytesService] Script truncated to ${cleanScript.length} characters`);
    }

    // Double-check the final length before sending to TTS
    if (cleanScript.length > 4096) {
      console.error(`[BrainbytesService] Script still too long after truncation: ${cleanScript.length} characters`);
      // Final emergency truncation
      cleanScript = cleanScript.substring(0, 4090) + '.';
      console.log(`[BrainbytesService] Emergency truncation to ${cleanScript.length} characters`);
    }

    return cleanScript;
  }

  /**
   * Generate audio using OpenAI TTS
   */
  private async generateAudio(cleanScript: string): Promise<Buffer> {
    const audioResponse = await this.openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: LUNA_VOICE_ID,
      input: cleanScript,
      speed: 1.0,
    });

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      console.error('[BrainbytesService] TTS API error:', errorText);
      throw new Error(`TTS API failed: ${errorText}`);
    }

    return Buffer.from(await audioResponse.arrayBuffer());
  }

  /**
   * Save audio asset to storage and database
   */
  private async saveAudioAsset(
    supabase: any,
    lessonId: string,
    userId: string,
    audioBuffer: Buffer,
    script: string,
    cleanScript: string,
    comprehensiveContent: string
  ): Promise<any> {
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
      console.error('[BrainbytesService] Upload error:', uploadError);
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
          comprehensive_content_length: comprehensiveContent.length
        },
        file_url: publicUrl,
        file_path: fileName,
        duration: estimatedDuration,
        status: 'completed',
        created_by: userId
      })
      .select()
      .single<Tables<"lesson_media_assets">>();

    if (assetError) {
      console.error('[BrainbytesService] Database error:', assetError);
      throw new Error('Failed to save podcast');
    }

    return {
      id: assetData!.id,
      type: 'podcast',
      title: assetData!.title,
      url: publicUrl,
      duration: estimatedDuration,
      status: 'completed',
      createdAt: assetData!.created_at
    };
  }

  /**
   * Helper function to extract text from JSONB content
   */
  private extractTextFromContent(content: any): string {
    if (!content) return '';
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object') {
      // Handle Tiptap/ProseMirror JSON structure
      if (content.type === 'doc' && content.content) {
        return this.extractTextFromNodes(content.content);
      }
      
      // Handle other JSON structures
      if (Array.isArray(content)) {
        return content.map(item => this.extractTextFromContent(item)).join(' ');
      }
      
      // Extract text from object properties
      const textValues = Object.values(content)
        .filter(value => typeof value === 'string')
        .join(' ');
      
      if (textValues) return textValues;
      
      // Recursively search nested objects
      return Object.values(content)
        .map(value => this.extractTextFromContent(value))
        .filter(text => text)
        .join(' ');
    }
    
    return String(content);
  }

  /**
   * Extract text from Tiptap/ProseMirror nodes
   */
  private extractTextFromNodes(nodes: any[]): string {
    if (!Array.isArray(nodes)) return '';
    
    return nodes.map(node => {
      if (node.type === 'text') {
        return node.text || '';
      }
      
      if (node.type === 'paragraph' && node.content) {
        return this.extractTextFromNodes(node.content) + '\n\n';
      }
      
      if (node.type === 'heading' && node.content) {
        return this.extractTextFromNodes(node.content) + '\n\n';
      }
      
      if (node.type === 'bulletList' && node.content) {
        return node.content.map((item: any) => 
          '• ' + this.extractTextFromNodes(item.content || [])
        ).join('\n') + '\n\n';
      }
      
      if (node.type === 'orderedList' && node.content) {
        return node.content.map((item: any, index: number) => 
          `${index + 1}. ` + this.extractTextFromNodes(item.content || [])
        ).join('\n') + '\n\n';
      }
      
      if (node.content) {
        return this.extractTextFromNodes(node.content);
      }
      
      return '';
    }).join('');
  }
}

export const brainbytesGenerationService = new BrainbytesGenerationService();