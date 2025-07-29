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
        name: 'BrainBytes Generator',
        systemPrompt: `You are Luna, an expert educational AI assistant specializing in creating standalone 2-3 minute educational podcasts. You help teachers create engaging audio content that students can listen to independently.

CONVERSATION APPROACH:
- Understand the topic they want to create a podcast about
- Ask about the grade level for age-appropriate content
- Ask about the learning context (warm-up, transition, independent study)
- Gather any specific focus areas or learning objectives

IMPORTANT: You will ALWAYS create exactly ONE 2-3 minute educational podcast. Never ask about quantity or how many episodes - it's always just one standalone podcast.

WHEN READY: Create a podcast script using this EXACT format:

# BrainBytes Podcast: [Topic Title]

## Introduction (15-20 seconds)
[Engaging hook and topic introduction]

## Main Content (90-120 seconds)
[Educational content broken into digestible segments with smooth transitions]

## Conclusion (15-20 seconds)
[Summary and memorable takeaway]

---

**Podcast Details:**
- **Grade Level:** [Grade level]
- **Duration:** 2-3 minutes
- **Topic:** [Main topic]
- **Key Learning Points:** [3-4 bullet points]

IMPORTANT: This will be converted to audio, so write in a conversational, engaging tone suitable for listening. Use natural speech patterns and include cues for emphasis.`,
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
      (toolId === 'brain-bytes' && (response.includes('## Introduction') && response.includes('## Main Content')));

    // For BrainBytes, always generate audio if we have any structured content
    if (toolId === 'brain-bytes' && (response.includes('## Introduction') || response.includes('## Main Content'))) {
      console.log('🎵 BrainBytes: Starting audio generation...');
      try {
        // Extract the script content from Luna's response - handle timing annotations
        const scriptMatch = response.match(/## Introduction[\s\S]*?(?=---|\n\n\*\*|$)/);
        let script = scriptMatch ? scriptMatch[0] : response;
        
        console.log('🎵 BrainBytes: Extracted script:', script.substring(0, 200) + '...');
        
        // Remove timing annotations from headers (e.g., "## Introduction (15-20 seconds)")
        script = script.replace(/^##\s+([^(]+)\s*\([^)]+\)/gm, '## $1');
        
        // Clean up script for TTS (remove markdown formatting)
        let cleanScript = script
          .replace(/^##\s+.*$/gm, '') // Remove entire markdown header lines
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
          .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
          .replace(/\n\n+/g, '\n\n') // Normalize line breaks
          .replace(/^\s*\n/gm, '') // Remove empty lines at start
          .trim();
        
        console.log('🎵 BrainBytes: Cleaned script preview:', cleanScript.substring(0, 200) + '...');

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
          voice: 'nova', // Luna's voice
          input: cleanScript,
          speed: 1.0,
        });

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          console.error('TTS API error:', errorText);
          throw new Error(`TTS API failed: ${errorText}`);
        }

        // Convert audio to buffer
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        
        // Calculate estimated duration
        const wordCount = cleanScript.split(/\s+/).length;
        const estimatedDuration = Math.round((wordCount / 150) * 60); // in seconds

        // Create Supabase client for file upload
        const supabase = createSupabaseServerClient();
        
        // Upload audio to Supabase Storage
        const fileName = `brainbytes_luna_${Date.now()}.mp3`;
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

        // Create BrainBytesContent object
        const brainBytesContent = {
          script: response,
          cleanScript: cleanScript,
          audioUrl: publicUrl,
          fileName: fileName,
          duration: estimatedDuration,
          title: 'BrainBytes Podcast',
          metadata: {
            topic: 'Generated by Luna',
            gradeLevel: 'General',
            duration: estimatedDuration,
            generatedAt: new Date().toISOString(),
            wordCount: wordCount,
            scriptLength: cleanScript.length,
            voice: 'nova'
          }
        };

        console.log('🎵 BrainBytes: Audio generation successful!', {
          audioUrl: brainBytesContent.audioUrl,
          duration: brainBytesContent.duration,
          title: brainBytesContent.title
        });

        const responseData = {
          response,
          isComplete: true, // Always mark as complete when we generate audio
          toolId,
          audioContent: brainBytesContent,
          conversationHistory: [
            ...conversationHistory,
            { role: 'user', content: prompt },
            { role: 'assistant', content: response }
          ]
        };

        console.log('🎵 BrainBytes: Returning response to frontend:', {
          isComplete: responseData.isComplete,
          hasAudioContent: !!responseData.audioContent,
          audioContentKeys: responseData.audioContent ? Object.keys(responseData.audioContent) : [],
          toolId: responseData.toolId
        });

        return NextResponse.json(responseData);
      } catch (error) {
        console.error('Error generating BrainBytes audio:', error);
        // Return the text response with an error message if audio generation fails
        return NextResponse.json({
          response: response + '\n\n⚠️ Audio generation failed. Please try again.',
          isComplete: false, // Don't mark as complete if audio generation failed
          toolId,
          error: 'Audio generation failed',
          conversationHistory: [
            ...conversationHistory,
            { role: 'user', content: prompt },
            { role: 'assistant', content: response }
          ]
        });
      }
    }

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