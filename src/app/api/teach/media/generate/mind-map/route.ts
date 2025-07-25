import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Tables } from 'packages/types/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extract rich text content from JSONB
function extractTextContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  
  if (content.type === 'doc' && content.content) {
    return extractFromNodes(content.content);
  }
  
  return '';
}

function extractFromNodes(nodes: any[]): string {
  if (!Array.isArray(nodes)) return '';
  
  return nodes.map(node => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'paragraph' && node.content) {
      return extractFromNodes(node.content) + '\n';
    }
    if (node.type === 'heading' && node.content) {
      return extractFromNodes(node.content) + '\n';
    }
    if (node.content) return extractFromNodes(node.content);
    return '';
  }).join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, baseClassId, userId, internal } = body;
    
    let supabase;
    let user;
    
    // Handle internal requests from course generation
    if (internal && userId) {
      // Use service role client for internal requests to bypass RLS
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      user = { id: userId };
      console.log('🔧 Internal mind map request (using service role):', { lessonId, userId, internal });
    } else {
      // Handle regular requests with authentication
      supabase = createSupabaseServerClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
    }

    // Determine the type of mind map to generate
    const isLessonMindMap = !!lessonId;
    const isBaseClassMindMap = !!baseClassId;

    if (!isLessonMindMap && !isBaseClassMindMap) {
      return NextResponse.json({ error: 'Either lessonId or baseClassId is required' }, { status: 400 });
    }

    if (isLessonMindMap && isBaseClassMindMap) {
      return NextResponse.json({ error: 'Cannot specify both lessonId and baseClassId' }, { status: 400 });
    }

    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';
    let mindMapData, svgHtml, assetData;

    if (isLessonMindMap) {
      // Generate lesson mind map
      const result = await generateLessonMindMap(supabase, lessonId, user, regenerate);
      mindMapData = result.mindMapData;
      svgHtml = result.svgHtml;
      assetData = result.assetData;
    } else {
      // Generate base class mind map
      const result = await generateBaseClassMindMap(supabase, baseClassId, user, regenerate);
      mindMapData = result.mindMapData;
      svgHtml = result.svgHtml;
      assetData = result.assetData;
    }

    return NextResponse.json({
      success: true,
      asset: assetData
    });

  } catch (error) {
    console.error('Mind map generation error:', error);
    return NextResponse.json({ error: 'Failed to generate mind map' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lessonId = searchParams.get('lessonId');
    const baseClassId = searchParams.get('baseClassId');
    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine the type of mind map to check
    const isLessonMindMap = !!lessonId;
    const isBaseClassMindMap = !!baseClassId;

    if (!isLessonMindMap && !isBaseClassMindMap) {
      return NextResponse.json({ error: 'Either lessonId or baseClassId is required' }, { status: 400 });
    }

    if (isLessonMindMap && isBaseClassMindMap) {
      return NextResponse.json({ error: 'Cannot specify both lessonId and baseClassId' }, { status: 400 });
    }

    if (isLessonMindMap) {
      // Check for lesson mind map
      const { data: assets } = await supabase
        .from('lesson_media_assets')
        .select('id, title, created_at')
        .eq('lesson_id', lessonId)
        .eq('asset_type', 'mind_map')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (assets && assets.length > 0) {
        return NextResponse.json({
          exists: true,
          asset: {
            ...(assets[0] as any),
            url: `/api/teach/media/mind-map/${(assets[0] as any).id}`
          }
        });
      }
    } else {
      // Check for base class mind map
      if (!baseClassId) {
        return NextResponse.json({ error: 'baseClassId is required for base class mind map check' }, { status: 400 });
      }
      
      const { data: assets } = await supabase
        .from('base_class_media_assets')
        .select('id, title, created_at')
        .eq('base_class_id', baseClassId)
        .eq('asset_type', 'mind_map')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (assets && assets.length > 0) {
        return NextResponse.json({
          exists: true,
          asset: {
            ...(assets[0] as any),
            url: `/api/teach/media/mind-map/${(assets[0] as any).id}`
          }
        });
      }
    }

    return NextResponse.json({ exists: false, asset: null });

  } catch (error) {
    console.error('Error checking for mind map:', error);
    return NextResponse.json({ error: 'Failed to check mind map' }, { status: 500 });
  }
}

async function generateLessonMindMap(supabase: any, lessonId: string, user: any, regenerate: boolean) {
  // Check for existing mind map
  if (!regenerate) {
    const { data: existingAssets } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed');

    if (existingAssets && existingAssets.length > 0) {
      throw new Error('A mind map already exists for this lesson');
    }
  }

  if (regenerate) {
    await supabase
      .from('lesson_media_assets')
      .delete()
      .eq('lesson_id', lessonId)
      .eq('asset_type', 'mind_map');
  }

  // Fetch lesson and sections separately to avoid join issues with .single()
  console.log('🔍 Fetching lesson for mind map:', lessonId);
  
  // First, get the lesson
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('title, description')
    .eq('id', lessonId)
    .single();

  console.log('📊 Lesson query result:', { lesson: !!lesson, error: lessonError });

  if (!lesson) {
    console.error('❌ Lesson not found for mind map:', { lessonId, error: lessonError });
    throw new Error(`Lesson not found: ${lessonError?.message || 'Unknown error'}`);
  }

  // Then, get the lesson sections
  const { data: lessonSections, error: sectionsError } = await supabase
    .from('lesson_sections')
    .select('title, content, section_type, order_index')
    .eq('lesson_id', lessonId)
    .order('order_index');

  console.log('📊 Lesson sections query result:', { 
    sectionsCount: lessonSections?.length || 0, 
    error: sectionsError 
  });

  if (sectionsError) {
    console.error('❌ Failed to fetch lesson sections:', { lessonId, error: sectionsError });
    throw new Error(`Failed to fetch lesson sections: ${sectionsError.message}`);
  }

  // Combine the data
  const lessonWithSections = {
    ...lesson,
    lesson_sections: lessonSections || []
  };

  // Enhanced content extraction with deeper analysis
  const lessonContent = {
    title: lessonWithSections.title,
    description: lessonWithSections.description || '',
    sections: lessonWithSections.lesson_sections?.sort((a: any, b: any) => a.order_index - b.order_index).map((section: any) => {
      const content = extractTextContent(section.content);
      const keyPoints = extractKeyPoints(content);
      const detailedConcepts = extractDetailedConcepts(content);
      
      return {
        title: section.title,
        content: content,
        type: section.section_type,
        keyPoints: keyPoints,
        concepts: detailedConcepts.slice(0, 4), // Limit to 4 main concepts per section
        summary: content.substring(0, 300) // Section summary
      };
    }) || []
  };

  // Generate mind map with AI - enhanced prompt for deeper hierarchy
  const prompt = `Create a comprehensive, multi-level mind map from this lesson content. Extract ACTUAL content and create a deep hierarchy.

LESSON STRUCTURE:
${JSON.stringify(lessonContent, null, 2)}

REQUIREMENTS:
1. Center: Lesson title "${lessonContent.title}"
2. Level 1: Main sections (up to 6 branches)
3. Level 2: Key concepts from each section (3-5 per branch)
4. Level 3: Detailed points and examples (2-4 per concept)
5. Level 4: Specific details and applications (1-3 per point)
6. Use ACTUAL content from lesson sections
7. **Progressively Detailed Descriptions:**
    - Level 1 descriptions: A concise, one-sentence overview of the section.
    - Level 2 descriptions: A 2-3 sentence explanation of the concept.
    - Level 3 descriptions: A 3-4 sentence detailed explanation with examples.
    - Level 4 descriptions: An in-depth, 4-5 sentence analysis of the specific detail.
8. Logical hierarchy progression

OUTPUT FORMAT (valid JSON only):
{
  "center": {
    "label": "${lessonContent.title}",
    "description": "${lessonContent.description || 'Comprehensive lesson overview'}"
  },
  "branches": [
    {
      "id": "section1",
      "label": "Section Name",
      "description": "Section overview and learning objectives",
      "color": "#DC2626",
      "concepts": [
        {
          "id": "concept1",
          "label": "Key Concept",
          "description": "Detailed concept explanation",
          "points": [
            {
              "id": "point1",
              "label": "Important Point",
              "description": "Point explanation with context",
              "details": [
                {
                  "id": "detail1",
                  "label": "Specific Detail",
                  "description": "Detailed explanation or example"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Colors: #DC2626, #059669, #7C3AED, #EA580C, #0891B2, #BE185D`;

  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You create educational mind maps with deep hierarchical structure. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 12000
  });

  let mindMapData;
  try {
    const responseText = aiResponse.choices[0]?.message?.content || '{}';
    const cleanedJson = responseText.replace(/```json\s*|\s*```/g, '').trim();
    mindMapData = JSON.parse(cleanedJson);
  } catch (error) {
    // Enhanced fallback structure with deeper hierarchy
    const colors = ['#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D'];
    mindMapData = {
      center: {
        label: lessonContent.title,
        description: lessonContent.description || 'Comprehensive lesson'
      },
      branches: lessonContent.sections.slice(0, 6).map((section: any, index: number) => ({
        id: `section${index + 1}`,
        label: section.title,
        description: section.summary,
        color: colors[index],
        concepts: section.concepts.slice(0, 4).map((concept: any, conceptIndex: number) => ({
          id: `concept${index + 1}_${conceptIndex + 1}`,
          label: concept.title,
          description: concept.description,
          points: concept.points?.slice(0, 3).map((point: any, pointIndex: number) => ({
            id: `point${index + 1}_${conceptIndex + 1}_${pointIndex + 1}`,
            label: point.title || point,
            description: point.description || point,
            details: point.details?.slice(0, 2).map((detail: any, detailIndex: number) => ({
              id: `detail${index + 1}_${conceptIndex + 1}_${pointIndex + 1}_${detailIndex + 1}`,
              label: detail.title || detail,
              description: detail.description || detail
            })) || []
          })) || []
        }))
      }))
    };
  }

  // Generate premium SVG mind map with enhanced positioning
  const svgHtml = generateInteractiveSVGMindMap(mindMapData, lessonContent.title);

  // Save to database
  const { data: asset } = await supabase
    .from('lesson_media_assets')
    .insert({
      lesson_id: lessonId,
      asset_type: 'mind_map',
      title: lessonContent.title,
      content: mindMapData,
      svg_content: svgHtml,
      status: 'completed',
      created_by: user.id
    })
    .select()
    .single();

  return {
    mindMapData,
    svgHtml,
    assetData: {
      id: asset.id,
      url: `/api/teach/media/mind-map/${asset.id}`,
      title: asset.title
    }
  };
}

async function generateBaseClassMindMap(supabase: any, baseClassId: string, user: any, regenerate: boolean) {
  // Check for existing mind map
  if (!regenerate) {
    const { data: existingAssets } = await supabase
      .from('base_class_media_assets')
      .select('*')
      .eq('base_class_id', baseClassId)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed');

    if (existingAssets && existingAssets.length > 0) {
      throw new Error('A mind map already exists for this base class');
    }
  }

  if (regenerate) {
    await supabase
      .from('base_class_media_assets')
      .delete()
      .eq('base_class_id', baseClassId)
      .eq('asset_type', 'mind_map');
  }

  // Fetch comprehensive content
  const { data: baseClass } = await supabase
    .from('base_classes')
    .select(`
      name,
      description,
      paths (
        title,
        description,
        order_index,
        lessons (
          title,
          description,
          order_index,
          lesson_sections (
            title,
            content,
            section_type,
            order_index
          )
        )
      )
    `)
    .eq('id', baseClassId)
    .single();

  if (!baseClass) {
    throw new Error('Base class not found');
  }

  // Structure content for mind map
  const courseContent = {
    title: baseClass.name,
    description: baseClass.description || '',
    modules: baseClass.paths?.sort((a: any, b: any) => a.order_index - b.order_index).map((path: any) => ({
      title: path.title,
      description: path.description || '',
      lessons: path.lessons?.sort((a: any, b: any) => a.order_index - b.order_index).map((lesson: any) => ({
        title: lesson.title,
        description: lesson.description || '',
        concepts: lesson.lesson_sections?.sort((a: any, b: any) => a.order_index - b.order_index).map((section: any) => {
          const content = extractTextContent(section.content);
          return {
            title: section.title,
            content: content.substring(0, 300),
            type: section.section_type
          };
        }) || []
      })) || []
    })) || []
  };

  // Generate mind map with AI
  const prompt = `Create a comprehensive 5-level mind map from this course content. Extract and organize the ACTUAL content with maximum depth.

COURSE STRUCTURE:
${JSON.stringify(courseContent, null, 2)}

REQUIREMENTS FOR 5-LEVEL STRUCTURE:
1. CENTER: Course title with brief description
2. BRANCHES: Course modules/paths (up to 6, numbered) 
3. CONCEPTS: Key lessons and topics from each module (3-5 per branch)
4. POINTS: Important concepts and learning objectives from each lesson (3-4 per concept)
5. DETAILS: Specific facts, examples, or sub-points (2-3 per point)

CONTENT EXTRACTION RULES:
- Extract actual content from lesson sections, not just titles
- Create meaningful hierarchical relationships
- Use rich descriptions from the provided content
- Include practical examples and key takeaways
- Ensure each level adds meaningful detail

OUTPUT FORMAT (valid JSON only):
{
  "center": {
    "label": "${courseContent.title}",
    "description": "Comprehensive course covering [key areas]"
  },
  "branches": [
    {
      "id": "module1", 
      "label": "1. Module Name",
      "description": "Module overview and objectives. This should be a concise, one-sentence summary.",
      "color": "#DC2626",
      "concepts": [
        {
          "label": "Lesson/Topic Name",
          "description": "What students will learn in this topic. This should be a 2-3 sentence explanation.",
          "points": [
            {
              "label": "Key Learning Point",
              "description": "Detailed explanation of the concept, including examples. This should be 3-4 sentences.",
              "details": [
                {
                  "label": "Specific Detail",
                  "description": "In-depth analysis or application of the detail. This should be 4-5 sentences."
                },
                {
                  "label": "Related Point", 
                  "description": "Additional supporting information"
                }
              ]
            },
            {
              "label": "Another Key Point",
              "description": "Another important aspect to understand",
              "details": [
                {
                  "label": "Supporting Example",
                  "description": "Concrete example or application"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

IMPORTANT: Must include the "points" level between concepts and details. Extract real content, not just structural titles.
**Descriptions must become progressively more detailed at each level as specified.**

Colors: #DC2626, #059669, #7C3AED, #EA580C, #0891B2, #BE185D`;

  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You create comprehensive educational mind maps with deep content extraction. Always return valid JSON with the complete 5-level structure including center, branches, concepts, points, and details.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 12000
  });

  let mindMapData;
  try {
    const responseText = aiResponse.choices[0]?.message?.content || '{}';
    const cleanedJson = responseText.replace(/```json\s*|\s*```/g, '').trim();
    mindMapData = JSON.parse(cleanedJson);
    
    // Validate structure - ensure points level exists
    if (mindMapData.branches) {
      mindMapData.branches.forEach((branch: any) => {
        if (branch.concepts) {
          branch.concepts.forEach((concept: any) => {
            if (!concept.points && concept.details) {
              // Convert old structure to new structure
              concept.points = concept.details.map((detail: any, index: number) => ({
                label: detail.label || `Key Point ${index + 1}`,
                description: detail.description || 'Important concept to understand',
                details: [
                  {
                    label: `Detail of ${detail.label || 'concept'}`,
                    description: detail.description?.substring(0, 100) || 'Supporting information'
                  }
                ]
              }));
              delete concept.details; // Remove old details
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('AI response parsing failed, using enhanced fallback structure');
    
    // Enhanced fallback structure with deep content extraction
    const colors = ['#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D'];
    mindMapData = {
      center: {
        label: courseContent.title,
        description: courseContent.description || `Comprehensive course covering ${courseContent.modules?.length || 0} modules`
      },
      branches: courseContent.modules.slice(0, 6).map((module: any, moduleIndex: number) => ({
        id: `module${moduleIndex + 1}`,
        label: `${moduleIndex + 1}. ${module.title}`,
        description: module.description || `Explore ${module.title} through structured lessons and practical applications`,
        color: colors[moduleIndex % colors.length],
        concepts: module.lessons.slice(0, 4).map((lesson: any, lessonIndex: number) => ({
          label: lesson.title,
          description: lesson.description || `Master the fundamentals and applications of ${lesson.title}`,
          points: lesson.concepts.slice(0, 4).map((concept: any, conceptIndex: number) => {
            // Extract key points from the content
            const contentParts = concept.content.split(/[.!?]+/).filter((part: string) => part.trim().length > 20);
            const mainPoint = contentParts[0]?.trim() || concept.title;
            const supportingPoint = contentParts[1]?.trim() || `Key aspects of ${concept.title}`;
            
            return {
              label: concept.title.length > 40 ? concept.title.substring(0, 40) + '...' : concept.title,
              description: mainPoint.length > 100 ? mainPoint.substring(0, 100) + '...' : mainPoint,
              details: [
                {
                  label: supportingPoint.length > 30 ? supportingPoint.substring(0, 30) + '...' : supportingPoint || 'Key Detail',
                  description: concept.content.substring(0, 120) || `Important information about ${concept.title}`
                },
                {
                  label: concept.type === 'text' ? 'Learning Focus' : concept.type === 'video' ? 'Visual Learning' : 'Interactive Element',
                  description: `This ${concept.type} section provides hands-on understanding of the topic`
                }
              ].filter(detail => detail.label && detail.description) // Remove empty details
            };
          }).filter((point: any) => point.details.length > 0) // Only include points with details
        }))
      }))
    };
  }

  // Generate premium SVG mind map
  const svgHtml = generateInteractiveSVGMindMap(mindMapData, courseContent.title);

  // Save to database
  const { data: asset } = await supabase
    .from('base_class_media_assets')
    .insert({
      base_class_id: baseClassId,
      asset_type: 'mind_map',
      title: baseClass.name,
      content: mindMapData,
      svg_content: svgHtml,
      status: 'completed',
      created_by: user.id
    })
    .select()
    .single();

  return {
    mindMapData,
    svgHtml,
    assetData: {
      id: asset.id,
      url: `/api/teach/media/mind-map/${asset.id}`,
      title: asset.title
    }
  };
}

function extractDetailedConcepts(content: string): any[] {
  if (!content) return [];
  
  // Split content into paragraphs and extract concepts
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  
  return paragraphs.slice(0, 6).map((paragraph, index) => {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const title = sentences[0]?.trim().substring(0, 80) || `Concept ${index + 1}`;
    
    return {
      title: title,
      description: paragraph.substring(0, 200),
      points: sentences.slice(1, 4).map(sentence => ({
        title: sentence.trim().substring(0, 60),
        description: sentence.trim(),
        details: extractDetailsFromSentence(sentence)
      }))
    };
  });
}

function extractDetailsFromSentence(sentence: string): any[] {
  // Extract key phrases and terms from a sentence
  const words = sentence.split(' ').filter(word => word.length > 4);
  const keyPhrases = [];
  
  // Simple heuristic to find important phrases
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 6 && words[i + 1].length > 4) {
      keyPhrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  return keyPhrases.slice(0, 3).map(phrase => ({
    title: phrase,
    description: `Important aspect: ${phrase}`
  }));
}

function extractKeyPoints(content: string): string[] {
  if (!content) return [];
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 6).map(s => s.trim());
}

function generateInteractiveSVGMindMap(data: any, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Mind Map</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'SF Pro Display', sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
            color: #ffffff;
            overflow: hidden;
            height: 100vh;
            user-select: none;
            cursor: grab;
        }
        
        body:active { cursor: grabbing; }
        
        .mind-map-container {
            width: 100%;
            height: 100vh;
            position: relative;
        }
        
        #mindMapSvg {
            width: 100%;
            height: 100%;
            background: transparent;
        }
        
        /* Premium node styles */
        .center-node {
            filter: drop-shadow(0 12px 40px rgba(0, 0, 0, 0.4));
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        
        .center-node:hover {
            filter: drop-shadow(0 16px 48px rgba(255, 255, 255, 0.1)) drop-shadow(0 12px 40px rgba(0, 0, 0, 0.5));
        }
        
        .main-branch {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            cursor: pointer;
            filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.3));
        }
        
        .main-branch:hover {
            filter: drop-shadow(0 8px 28px rgba(255, 255, 255, 0.08)) drop-shadow(0 6px 20px rgba(0, 0, 0, 0.4));
        }
        
        .concept-node {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            cursor: pointer;
            filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.25));
        }
        
        .concept-node:hover {
            filter: drop-shadow(0 6px 20px rgba(255, 255, 255, 0.06)) drop-shadow(0 4px 16px rgba(0, 0, 0, 0.35));
        }
        
        .point-node {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            cursor: pointer;
            filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.2));
        }
        
        .point-node:hover {
            filter: drop-shadow(0 4px 16px rgba(255, 255, 255, 0.05)) drop-shadow(0 2px 12px rgba(0, 0, 0, 0.3));
        }
        
        .detail-node {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            cursor: pointer;
            filter: drop-shadow(0 1px 8px rgba(0, 0, 0, 0.15));
        }
        
        .detail-node:hover {
            filter: drop-shadow(0 2px 12px rgba(255, 255, 255, 0.04)) drop-shadow(0 1px 8px rgba(0, 0, 0, 0.25));
        }
        
        /* Connection lines */
        .connection-line {
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            stroke-linecap: round;
        }
        
        .connection-line:hover {
            stroke-width: 1.5;
            opacity: 1;
        }
        
        /* Cross-connections for concept linking */
        .cross-connection {
            stroke: #fbbf24;
            stroke-width: 2;
            stroke-dasharray: 8,4;
            opacity: 0;
            transition: opacity 0.3s ease;
            stroke-linecap: round;
        }
        
        .cross-connection.visible {
            opacity: 0.6;
        }
        
        .expandable {
            opacity: 0;
            transform: scale(0.8);
            transform-origin: center;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .expandable.visible {
            opacity: 1;
            transform: scale(1);
        }
        
        /* Connection mode toggle */
        .mode-toggle {
            position: fixed;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 16px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            z-index: 1000;
        }
        
        .mode-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #ffffff;
            padding: 10px 16px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            backdrop-filter: blur(10px);
        }
        
        .mode-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
        }
        
        .mode-btn.active {
            background: rgba(251, 191, 36, 0.2);
            border-color: rgba(251, 191, 36, 0.4);
            color: #fbbf24;
        }
        
        /* Premium controls */
        .controls {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 1000;
        }
        
        .control-group {
            display: flex;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 16px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .control-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #ffffff;
            padding: 10px 14px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            min-width: 44px;
            text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .control-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }
        
        .control-btn:active {
            transform: translateY(0);
        }
        
        /* Premium info panel */
        .info-panel {
            position: fixed;
            top: 24px;
            left: 24px;
            max-width: 380px;
            background: rgba(255, 255, 255, 0.05);
            padding: 20px;
            border-radius: 16px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transform: translateX(-100%);
            transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            z-index: 1000;
        }
        
        .info-panel.visible { 
            transform: translateX(0);
        }
        
        .info-panel h3 {
            margin-bottom: 12px;
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
            line-height: 1.3;
        }
        
        .info-panel p {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
            line-height: 1.6;
        }
        
        /* Node text styling */
        .node-text {
            pointer-events: none;
            font-weight: 500;
        }
        
        .center-text {
            font-weight: 700;
            font-size: 16px;
        }
        
        .branch-text {
            font-weight: 600;
            font-size: 14px;
        }
        
        .concept-text {
            font-weight: 500;
            font-size: 12px;
        }
        
        .point-text {
            font-weight: 400;
            font-size: 10px;
        }
        
        .detail-text {
            font-weight: 300;
            font-size: 9px;
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <svg id="mindMapSvg" viewBox="0 0 1600 1200">
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                
                <filter id="shadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="rgba(0,0,0,0.3)"/>
                </filter>
                
                <linearGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#2d3748"/>
                    <stop offset="100%" stop-color="#1a202c"/>
                </linearGradient>
            </defs>
            
            <g id="connectionsGroup"></g>
            <g id="crossConnectionsGroup"></g>
            <g id="nodesGroup"></g>
        </svg>
    </div>
    
    <div class="mode-toggle">
        <button class="mode-btn" id="connectionModeBtn" onclick="toggleConnectionMode()">
            🔗 Concept Links
        </button>
    </div>
    
    <div class="info-panel" id="infoPanel">
        <h3 id="infoTitle">Select a node</h3>
        <p id="infoDescription">Click on any node to explore detailed information and expand the hierarchy</p>
    </div>
    
        <div class="controls">
            <div class="control-group">
            <button class="control-btn" onclick="zoomIn()" title="Zoom In">+</button>
            <button class="control-btn" onclick="zoomOut()" title="Zoom Out">−</button>
            <button class="control-btn" onclick="resetView()" title="Reset View">⌂</button>
            </div>
            <div class="control-group">
            <button class="control-btn" onclick="expandAll()" title="Expand All">⊞</button>
            <button class="control-btn" onclick="collapseAll()" title="Collapse All">⊟</button>
            </div>
    </div>
    
    <script>
        const mindMapData = ${JSON.stringify(data)};
        
        let currentScale = 1;
        let currentTranslateX = 0;
        let currentTranslateY = 0;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let expandedNodes = new Set();
        let connectionMode = false;
        let nodePositions = new Map();
        let selectedNode = null; // Track currently selected node for visual feedback
        
        const svg = document.getElementById('mindMapSvg');
        const nodesGroup = document.getElementById('nodesGroup');
        const connectionsGroup = document.getElementById('connectionsGroup');
        const crossConnectionsGroup = document.getElementById('crossConnectionsGroup');
        const infoPanel = document.getElementById('infoPanel');
        
        // Enhanced positioning constants with better spacing for outer levels
        const LAYOUT = {
            centerX: 800,
            centerY: 600,
            centerRadius: 80,
            branchRadius: 420,  // Increased for more room
            conceptRadius: 280, // Increased for more room
            pointRadius: 180,   // Increased for more room  
            detailRadius: 120,  // Increased for more room
            minAngleSpacing: 0.6, // Increased for better spacing
            overlapBuffer: 40,    // Increased buffer
            minNodeDistance: 35   // Increased minimum distance between nodes
        };
        
        function initializeMindMap() {
            drawMindMap();
            setupEventListeners();
        }
        
        function drawMindMap() {
            nodesGroup.innerHTML = '';
            connectionsGroup.innerHTML = '';
            crossConnectionsGroup.innerHTML = '';
            nodePositions.clear();
            selectedNode = null; // Reset selection
            
            drawCenterNode();
            
            const branches = mindMapData.branches || [];
            branches.forEach((branch, index) => {
                drawBranch(branch, index, branches.length);
            });
            
            // Generate cross-connections in connection mode
            if (connectionMode) {
                generateCrossConnections();
            }
        }
        
        function drawCenterNode() {
            const centerData = mindMapData.center;
            const { centerX, centerY } = LAYOUT;
            
            // Dynamic sizing based on text
            const textMetrics = measureText(centerData.label, 16, 'bold');
            const radius = Math.max(60, Math.min(100, textMetrics.width / 2 + 20));
            
            nodePositions.set('center', { 
                x: centerX, 
                y: centerY, 
                radius: radius,
                data: centerData 
            });
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', centerX);
            circle.setAttribute('cy', centerY);
            circle.setAttribute('r', radius);
            circle.setAttribute('fill', 'url(#centerGradient)');
            circle.setAttribute('stroke', '#4a5568');
            circle.setAttribute('stroke-width', '3');
            circle.setAttribute('class', 'center-node');
            circle.setAttribute('filter', 'url(#shadow)');
            
            const text = createWrappedText(centerX, centerY, centerData.label, {
                maxWidth: radius * 1.6,
                fontSize: 16,
                fontWeight: 'bold',
                fill: '#ffffff',
                className: 'center-text'
            });
            
            nodesGroup.appendChild(circle);
            nodesGroup.appendChild(text);
            
            circle.addEventListener('click', () => {
                highlightSelectedNode(circle, 'center');
                showNodeInfo(centerData.label, centerData.description);
            });
        }
        
        function drawBranch(branchData, branchIndex, totalBranches) {
            const { centerX, centerY, branchRadius } = LAYOUT;
            const angle = -Math.PI / 2 + (branchIndex * 2 * Math.PI / totalBranches);
            const x = centerX + Math.cos(angle) * branchRadius;
            const y = centerY + Math.sin(angle) * branchRadius;
            
            // Dynamic sizing based on text
            const textMetrics = measureText(branchData.label, 14, 'bold');
            const width = Math.max(textMetrics.width + 40, 150);
            const height = Math.max(textMetrics.height + 20, 50);
            const nodeRadius = Math.max(width, height) / 2;
            
            nodePositions.set(\`branch-\${branchIndex}\`, { 
                x, 
                y, 
                radius: nodeRadius,
                data: branchData 
            });
            
            // Draw straight connection to center
            const line = createStraightPath(centerX, centerY, x, y, branchData.color, 4);
            connectionsGroup.appendChild(line);
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x - width/2);
            rect.setAttribute('y', y - height/2);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', height/2);
            rect.setAttribute('fill', branchData.color);
            rect.setAttribute('class', 'main-branch');
            rect.setAttribute('filter', 'url(#shadow)');
            rect.setAttribute('data-branch', branchIndex);
            
            const text = createWrappedText(x, y, branchData.label, {
                maxWidth: width - 20,
                fontSize: 14,
                fontWeight: 'bold',
                fill: '#ffffff',
                className: 'branch-text'
            });
            
            nodesGroup.appendChild(rect);
            nodesGroup.appendChild(text);
            
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                highlightSelectedNode(rect, \`branch-\${branchIndex}\`);
                toggleBranch(branchIndex, x, y, branchData, angle);
                showNodeInfo(branchData.label, branchData.description);
            });
            
            if (expandedNodes.has(\`branch-\${branchIndex}\`)) {
                drawConcepts(x, y, branchData, angle, branchIndex);
            }
        }
        
        function measureText(text, fontSize = 14, fontWeight = 'normal') {
            // Create a temporary SVG text element to measure dimensions
            const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tempText.textContent = text;
            tempText.setAttribute('font-size', fontSize);
            tempText.setAttribute('font-weight', fontWeight);
            tempText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SF Pro Display", sans-serif');
            tempText.style.visibility = 'hidden';
            
            // Add to SVG to measure
            document.getElementById('mindMapSvg').appendChild(tempText);
            const bbox = tempText.getBBox();
            document.getElementById('mindMapSvg').removeChild(tempText);
            
            return {
                width: bbox.width,
                height: bbox.height
            };
        }
        
        function drawConcepts(branchX, branchY, branchData, branchAngle, branchIndex) {
            const concepts = branchData.concepts || [];
            if (concepts.length === 0) return;
            
            // Create systematic positioning for concepts - cluster them in the branch's sector
            const branchSectorAngle = (2 * Math.PI) / (mindMapData.branches?.length || 6);
            const conceptStartAngle = branchAngle - (branchSectorAngle * 0.4);
            const conceptEndAngle = branchAngle + (branchSectorAngle * 0.4);
            
            // Calculate initial positions systematically within the branch sector
            const conceptPositions = concepts.map((concept, conceptIndex) => {
                const textMetrics = measureText(concept.label, 12, 'normal');
                const width = Math.max(textMetrics.width + 30, 100);
                const height = Math.max(textMetrics.height + 16, 35);
                const nodeRadius = Math.max(width, height) / 2 + 10; // Add padding
                
                // Distribute concepts evenly within the branch's sector
                let angle;
                if (concepts.length === 1) {
                    angle = branchAngle;
                } else {
                    angle = conceptStartAngle + (conceptIndex / (concepts.length - 1)) * (conceptEndAngle - conceptStartAngle);
                }
                
                const baseX = branchX + Math.cos(angle) * LAYOUT.conceptRadius;
                const baseY = branchY + Math.sin(angle) * LAYOUT.conceptRadius;
                
                return {
                    x: baseX,
                    y: baseY,
                    angle: angle,
                    nodeRadius: nodeRadius,
                    width: width,
                    height: height,
                    data: concept,
                    conceptIndex: conceptIndex,
                    key: \`concept-\${branchIndex}-\${conceptIndex}\`
                };
            });
            
            // Adjust positions to avoid collisions
            const adjustedPositions = adjustPositionsForCollisions(conceptPositions);
            
            // Draw concepts with collision-free positions
            adjustedPositions.forEach((pos) => {
                const concept = pos.data;
                const conceptIndex = pos.conceptIndex;
                const conceptKey = pos.key;
                
                // Update position in the map (it was temporarily added during adjustment)
                nodePositions.set(conceptKey, { 
                    x: pos.x, 
                    y: pos.y, 
                    radius: pos.nodeRadius,
                    data: concept 
                });
                
                // Straight connection to branch
                const line = createStraightPath(branchX, branchY, pos.x, pos.y, branchData.color, 3);
                line.setAttribute('class', 'connection-line expandable visible');
                connectionsGroup.appendChild(line);
                
                const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                ellipse.setAttribute('cx', pos.x);
                ellipse.setAttribute('cy', pos.y);
                ellipse.setAttribute('rx', pos.width/2);
                ellipse.setAttribute('ry', pos.height/2);
                ellipse.setAttribute('fill', branchData.color + '60');
                ellipse.setAttribute('stroke', branchData.color);
                ellipse.setAttribute('stroke-width', '2');
                ellipse.setAttribute('class', 'concept-node expandable visible');
                ellipse.setAttribute('data-concept', conceptKey);
                
                const text = createWrappedText(pos.x, pos.y, concept.label, {
                    maxWidth: pos.width - 10,
                    fontSize: 12,
                    fill: '#ffffff',
                    className: 'concept-text'
                });
                text.setAttribute('class', 'expandable visible concept-text');
                
                nodesGroup.appendChild(ellipse);
                nodesGroup.appendChild(text);
                
                ellipse.addEventListener('click', (e) => {
                    e.stopPropagation();
                    highlightSelectedNode(ellipse, conceptKey);
                    toggleConcept(branchIndex, conceptIndex, pos.x, pos.y, concept, pos.angle, branchData.color);
                    showNodeInfo(concept.label, concept.description);
                });
                
                if (expandedNodes.has(conceptKey)) {
                    drawPoints(pos.x, pos.y, concept, pos.angle, branchIndex, conceptIndex, branchData.color);
                }
            });
        }
        
        function drawPoints(conceptX, conceptY, conceptData, conceptAngle, branchIndex, conceptIndex, color) {
            const points = conceptData.points || [];
            if (points.length === 0) return;
            
            // Create systematic clustering for points around their parent concept
            const pointClusterRadius = LAYOUT.pointRadius;
            const maxPointsPerRow = 4; // Limit points per "ring" for better organization
            
            const pointPositions = points.map((point, pointIndex) => {
                const textMetrics = measureText(point.label.substring(0, 25), 10, 'normal');
                const radius = Math.max(textMetrics.width / 2 + 12, 20); // Increased padding
                
                // Organize points in concentric rings if many points
                const ringIndex = Math.floor(pointIndex / maxPointsPerRow);
                const positionInRing = pointIndex % maxPointsPerRow;
                const pointsInThisRing = Math.min(maxPointsPerRow, points.length - (ringIndex * maxPointsPerRow));
                
                // Calculate radius for this ring with better spacing
                const ringRadius = pointClusterRadius + (ringIndex * 100);
                
                // Calculate angle within the ring, keeping points clustered near parent concept direction
                const ringSpread = Math.min(Math.PI * 0.9, pointsInThisRing * 0.5);
                const startAngle = conceptAngle - ringSpread / 2;
                let angle;
                
                if (pointsInThisRing === 1) {
                    angle = conceptAngle;
                } else {
                    angle = startAngle + (positionInRing / (pointsInThisRing - 1)) * ringSpread;
                }
                
                const baseX = conceptX + Math.cos(angle) * ringRadius;
                const baseY = conceptY + Math.sin(angle) * ringRadius;
                
                return {
                    x: baseX,
                    y: baseY,
                    angle: angle,
                    nodeRadius: radius,
                    data: point,
                    pointIndex: pointIndex,
                    key: \`point-\${branchIndex}-\${conceptIndex}-\${pointIndex}\`
                };
            });
            
            // Adjust positions to avoid collisions
            const adjustedPositions = adjustPositionsForCollisions(pointPositions);
            
            // Draw points with collision-free positions
            adjustedPositions.forEach((pos) => {
                const point = pos.data;
                const pointIndex = pos.pointIndex;
                const pointKey = pos.key;
                
                // Update position in the map
                nodePositions.set(pointKey, { 
                    x: pos.x, 
                    y: pos.y, 
                    radius: pos.nodeRadius,
                    data: point 
                });
                
                // Straight connection to concept
                const line = createStraightPath(conceptX, conceptY, pos.x, pos.y, color, 2);
                line.setAttribute('class', 'connection-line expandable visible');
                connectionsGroup.appendChild(line);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', pos.x);
                circle.setAttribute('cy', pos.y);
                circle.setAttribute('r', pos.nodeRadius);
                circle.setAttribute('fill', color + '40');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('class', 'point-node expandable visible');
                
                const text = createWrappedText(pos.x, pos.y, point.label.substring(0, 25), {
                    maxWidth: pos.nodeRadius * 1.8,
                    fontSize: 10,
                    fill: '#ffffff',
                    className: 'point-text'
                });
                text.setAttribute('class', 'expandable visible point-text');
                
                nodesGroup.appendChild(circle);
                nodesGroup.appendChild(text);
                
                circle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    highlightSelectedNode(circle, pointKey);
                    togglePoint(branchIndex, conceptIndex, pointIndex, pos.x, pos.y, point, pos.angle, color);
                    showNodeInfo(point.label, point.description);
                });
                
                if (expandedNodes.has(pointKey)) {
                    drawDetails(pos.x, pos.y, point, pos.angle, branchIndex, conceptIndex, pointIndex, color);
                }
            });
        }
        
        function drawDetails(pointX, pointY, pointData, pointAngle, branchIndex, conceptIndex, pointIndex, color) {
            const details = pointData.details || [];
            if (details.length === 0) return;
            
            // Filter out malformed detail objects
            const validDetails = details.filter(detail => 
                detail && 
                typeof detail === 'object' && 
                detail.label && 
                detail.description
            );
            
            if (validDetails.length === 0) return;
            
            // Create tight clustering for details around their parent point
            const detailClusterRadius = LAYOUT.detailRadius;
            const maxDetailsPerRing = 3; // Smaller rings for details
            
            const detailPositions = validDetails.map((detail, detailIndex) => {
                const textMetrics = measureText(detail.label.substring(0, 15), 9, 'normal');
                const radius = Math.max(textMetrics.width / 2 + 8, 15); // Increased padding
                
                // Organize details in tight concentric rings
                const ringIndex = Math.floor(detailIndex / maxDetailsPerRing);
                const positionInRing = detailIndex % maxDetailsPerRing;
                const detailsInThisRing = Math.min(maxDetailsPerRing, validDetails.length - (ringIndex * maxDetailsPerRing));
                
                // Calculate radius for this ring with better spacing
                const ringRadius = detailClusterRadius + (ringIndex * 70);
                
                // Calculate angle within the ring, keeping details tightly clustered
                const ringSpread = Math.min(Math.PI * 0.7, detailsInThisRing * 0.6);
                const startAngle = pointAngle - ringSpread / 2;
                let angle;
                
                if (detailsInThisRing === 1) {
                    angle = pointAngle;
                } else {
                    angle = startAngle + (positionInRing / (detailsInThisRing - 1)) * ringSpread;
                }
                
                const baseX = pointX + Math.cos(angle) * ringRadius;
                const baseY = pointY + Math.sin(angle) * ringRadius;
                
                return {
                    x: baseX,
                    y: baseY,
                    angle: angle,
                    nodeRadius: radius,
                    data: detail,
                    detailIndex: detailIndex,
                    key: \`detail-\${branchIndex}-\${conceptIndex}-\${pointIndex}-\${detailIndex}\`
                };
            });
            
            // Adjust positions to avoid collisions
            const adjustedPositions = adjustPositionsForCollisions(detailPositions);
            
            // Draw details with collision-free positions
            adjustedPositions.forEach((pos) => {
                const detail = pos.data;
                const detailIndex = pos.detailIndex;
                const detailKey = pos.key;
                
                // Update position in the map
                nodePositions.set(detailKey, { 
                    x: pos.x, 
                    y: pos.y, 
                    radius: pos.nodeRadius,
                    data: detail 
                });
                
                // Straight connection to point
                const line = createStraightPath(pointX, pointY, pos.x, pos.y, color, 1);
                line.setAttribute('class', 'connection-line expandable visible');
                line.setAttribute('opacity', '0.6');
                connectionsGroup.appendChild(line);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', pos.x);
                circle.setAttribute('cy', pos.y);
                circle.setAttribute('r', pos.nodeRadius);
                circle.setAttribute('fill', color + '20');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1');
                circle.setAttribute('class', 'detail-node expandable visible');
                
                const text = createWrappedText(pos.x, pos.y, detail.label.substring(0, 15), {
                    maxWidth: pos.nodeRadius * 1.8,
                    fontSize: 9,
                    fill: '#ffffff',
                    className: 'detail-text'
                });
                text.setAttribute('class', 'expandable visible detail-text');
                
                nodesGroup.appendChild(circle);
                nodesGroup.appendChild(text);
                
                circle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    highlightSelectedNode(circle, detailKey);
                    showNodeInfo(detail.label, detail.description);
                });
            });
        }
        
        function createCurvedPath(x1, y1, x2, y2, color, strokeWidth) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dr = Math.sqrt(dx * dx + dy * dy);
            const sweep = dx > 0 ? 1 : 0;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', \`M\${x1},\${y1} A\${dr * 0.5},\${dr * 0.5} 0 0,\${sweep} \${x2},\${y2}\`);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', strokeWidth);
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.8');
            path.setAttribute('class', 'connection-line');
            
            return path;
        }
        
        function createStraightPath(x1, y1, x2, y2, color, strokeWidth) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', strokeWidth);
            line.setAttribute('opacity', '0.6');
            line.setAttribute('class', 'connection-line');
            
            return line;
        }
        
        function createWrappedText(x, y, text, options = {}) {
            const { maxWidth = 100, fontSize = 12, fontWeight = 'normal', fill = '#ffffff', className = '' } = options;
            
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', x);
            textElement.setAttribute('y', y);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('font-size', fontSize);
            textElement.setAttribute('font-weight', fontWeight);
            textElement.setAttribute('fill', fill);
            textElement.setAttribute('class', \`node-text \${className}\`);
            
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine ? \`\${currentLine} \${word}\` : word;
                if (testLine.length * fontSize * 0.6 > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
            } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) lines.push(currentLine);
            
            const lineHeight = fontSize + 2;
            const startY = y - ((lines.length - 1) * lineHeight) / 2;
            
            lines.forEach((line, index) => {
                const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.textContent = line;
                tspan.setAttribute('x', x);
                tspan.setAttribute('y', startY + index * lineHeight);
                textElement.appendChild(tspan);
            });
            
            return textElement;
        }
        
        function toggleBranch(branchIndex, x, y, branchData, angle) {
            const key = \`branch-\${branchIndex}\`;
            if (expandedNodes.has(key)) {
                expandedNodes.delete(key);
                removeExpandedElements(\`concept-\${branchIndex}-\`);
            } else {
                expandedNodes.add(key);
                drawConcepts(x, y, branchData, angle, branchIndex);
            }
            
            if (connectionMode) {
                generateCrossConnections();
            }
        }
        
        function toggleConcept(branchIndex, conceptIndex, x, y, conceptData, angle, color) {
            const key = \`concept-\${branchIndex}-\${conceptIndex}\`;
            if (expandedNodes.has(key)) {
                expandedNodes.delete(key);
                removeExpandedElements(\`point-\${branchIndex}-\${conceptIndex}-\`);
            } else {
                expandedNodes.add(key);
                drawPoints(x, y, conceptData, angle, branchIndex, conceptIndex, color);
            }
            
            if (connectionMode) {
                generateCrossConnections();
            }
        }
        
        function togglePoint(branchIndex, conceptIndex, pointIndex, x, y, pointData, angle, color) {
            const key = \`point-\${branchIndex}-\${conceptIndex}-\${pointIndex}\`;
            if (expandedNodes.has(key)) {
                expandedNodes.delete(key);
                removeExpandedElements(\`detail-\${branchIndex}-\${conceptIndex}-\${pointIndex}-\`);
            } else {
                expandedNodes.add(key);
                drawDetails(x, y, pointData, angle, branchIndex, conceptIndex, pointIndex, color);
            }
        }
        
        function removeExpandedElements(prefix) {
            const elementsToRemove = [];
            document.querySelectorAll('.expandable').forEach(el => {
                const dataAttrs = Object.keys(el.dataset);
                if (dataAttrs.some(attr => el.dataset[attr]?.startsWith(prefix))) {
                    elementsToRemove.push(el);
                }
            });
            
            // Also check by nodePositions keys
            for (const [key] of nodePositions) {
                if (key.startsWith(prefix)) {
                    nodePositions.delete(key);
                }
            }
            
            elementsToRemove.forEach(el => {
                el.classList.remove('visible');
                setTimeout(() => el.remove(), 400);
            });
            
            // Regenerate cross-connections if in connection mode
            if (connectionMode) {
                setTimeout(() => generateCrossConnections(), 500);
            }
        }
        
        function showNodeInfo(title, description) {
            document.getElementById('infoTitle').textContent = title;
            document.getElementById('infoDescription').textContent = description || 'Click to explore this concept further';
            infoPanel.classList.add('visible');
        }
        
        function setupEventListeners() {
            svg.addEventListener('mousedown', startDrag);
            svg.addEventListener('mousemove', drag);
            svg.addEventListener('mouseup', endDrag);
            svg.addEventListener('wheel', zoom);
            
            document.addEventListener('click', (e) => {
                // Clear selection if clicking on canvas background or info panel close
                if (e.target === svg || (!infoPanel.contains(e.target) && !e.target.closest('.main-branch, .concept-node, .point-node, .detail-node, .center-node'))) {
                    clearNodeSelection();
                    infoPanel.classList.remove('visible');
                }
            });
        }
        
        function startDrag(e) {
            isDragging = true;
            dragStartX = e.clientX - currentTranslateX;
            dragStartY = e.clientY - currentTranslateY;
            e.preventDefault();
        }
        
        function drag(e) {
            if (!isDragging) return;
            currentTranslateX = e.clientX - dragStartX;
            currentTranslateY = e.clientY - dragStartY;
            updateTransform();
            e.preventDefault();
        }
        
        function endDrag() {
            isDragging = false;
        }
        
        function zoom(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            currentScale = Math.max(0.3, Math.min(2.5, currentScale * delta));
            updateTransform();
        }
        
        function updateTransform() {
            const transform = \`translate(\${currentTranslateX}, \${currentTranslateY}) scale(\${currentScale})\`;
            nodesGroup.setAttribute('transform', transform);
            connectionsGroup.setAttribute('transform', transform);
            crossConnectionsGroup.setAttribute('transform', transform);
        }
        
        function zoomIn() {
            currentScale = Math.min(2.5, currentScale * 1.15);
            updateTransform();
        }
        
        function zoomOut() {
            currentScale = Math.max(0.3, currentScale * 0.85);
            updateTransform();
        }
        
        function resetView() {
            currentScale = 1;
            currentTranslateX = 0;
            currentTranslateY = 0;
            updateTransform();
        }
        
        function expandAll() {
            mindMapData.branches.forEach((branch, branchIndex) => {
                expandedNodes.add(\`branch-\${branchIndex}\`);
                
                // Safely handle concepts array
                if (branch.concepts && Array.isArray(branch.concepts)) {
                    branch.concepts.forEach((concept, conceptIndex) => {
                        expandedNodes.add(\`concept-\${branchIndex}-\${conceptIndex}\`);
                        
                        // Safely handle points array
                        if (concept.points && Array.isArray(concept.points)) {
                            concept.points.forEach((point, pointIndex) => {
                                expandedNodes.add(\`point-\${branchIndex}-\${conceptIndex}-\${pointIndex}\`);
                                
                                // Safely handle details array
                                if (point.details && Array.isArray(point.details)) {
                                    point.details.forEach((detail, detailIndex) => {
                                        // Only add if detail has proper structure
                                        if (detail && typeof detail === 'object' && detail.id) {
                                            expandedNodes.add(\`detail-\${branchIndex}-\${conceptIndex}-\${pointIndex}-\${detailIndex}\`);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
            drawMindMap();
        }
        
        function collapseAll() {
            expandedNodes.clear();
            drawMindMap();
        }
        
        function toggleConnectionMode() {
            connectionMode = !connectionMode;
            const btn = document.getElementById('connectionModeBtn');
            btn.classList.toggle('active');
            
            if (connectionMode) {
                generateCrossConnections();
            } else {
                crossConnectionsGroup.innerHTML = '';
            }
        }
        
        function generateCrossConnections() {
            const connections = [];
            const allNodes = Array.from(nodePositions.entries())
                .filter(([key]) => key !== 'center' && !key.startsWith('branch-'));
            
            // Track connections per node to limit overcrowding
            const nodeConnectionCount = new Map();
            const maxConnectionsPerNode = 3; // Limit each node to max 3 connections
            
            // More aggressive connection finding with multiple strategies
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const [key1, node1] = allNodes[i];
                    const [key2, node2] = allNodes[j];
                    
                    // Skip if same branch (we want cross-branch connections)
                    const branch1 = key1.split('-')[1];
                    const branch2 = key2.split('-')[1];
                    if (branch1 === branch2) continue;
                    
                    // Skip if either node already has too many connections
                    const count1 = nodeConnectionCount.get(key1) || 0;
                    const count2 = nodeConnectionCount.get(key2) || 0;
                    if (count1 >= maxConnectionsPerNode || count2 >= maxConnectionsPerNode) continue;
                    
                    const similarity = calculateSimilarity(node1.data.label, node2.data.label);
                    const conceptualSimilarity = calculateConceptualSimilarity(node1.data, node2.data);
                    const keywordMatch = calculateKeywordSimilarity(node1.data.label, node2.data.label);
                    
                    // Multiple connection criteria (much more selective)
                    let shouldConnect = false;
                    let connectionType = '';
                    let connectionStrength = 0;
                    
                    // Direct similarity (very strict threshold)
                    if (similarity > 0.5) {  // Increased from 0.25 - now very strict
                        shouldConnect = true;
                        connectionType = 'similar';
                        connectionStrength = similarity;
                    }
                    
                    // Conceptual similarity (very strict threshold)
                    if (conceptualSimilarity > 0.6) {  // Increased from 0.3 - now very strict
                        shouldConnect = true;
                        connectionType = 'conceptual';
                        connectionStrength = Math.max(connectionStrength, conceptualSimilarity);
                    }
                    
                    // Keyword matching (very strict threshold)
                    if (keywordMatch > 0.6) {  // Increased from 0.35 - now very strict
                        shouldConnect = true;
                        connectionType = 'keyword';
                        connectionStrength = Math.max(connectionStrength, keywordMatch);
                    }
                    
                    // Theme-based connections (very strict threshold)
                    const themeConnection = calculateThemeConnection(node1.data, node2.data);
                    if (themeConnection > 0.5) {  // Increased from 0.3 - now very strict
                        shouldConnect = true;
                        connectionType = 'thematic';
                        connectionStrength = Math.max(connectionStrength, themeConnection);
                    }
                    
                    // Action/process connections (very strict threshold)
                    const processConnection = calculateProcessConnection(node1.data.label, node2.data.label);
                    if (processConnection > 0.5) {  // Increased from 0.3 - now very strict
                        shouldConnect = true;
                        connectionType = 'process';
                        connectionStrength = Math.max(connectionStrength, processConnection);
                    }
                    
                    // Semantic relationships (very strict threshold)
                    const semanticConnection = calculateSemanticConnection(node1.data.label, node2.data.label);
                    if (semanticConnection > 0.4) {  // Increased from 0.25 - now very strict
                        shouldConnect = true;
                        connectionType = 'semantic';
                        connectionStrength = Math.max(connectionStrength, semanticConnection);
                    }
                    
                    // Opposition/contrast connections (kept very strict)
                    const contrastConnection = calculateContrastConnection(node1.data.label, node2.data.label);
                    if (contrastConnection > 0.5) {  // Increased from 0.3 - now very strict
                        shouldConnect = true;
                        connectionType = 'contrast';
                        connectionStrength = Math.max(connectionStrength, contrastConnection);
                    }
                    
                    if (shouldConnect) {
                        connections.push({
                            from: { x: node1.x, y: node1.y },
                            to: { x: node2.x, y: node2.y },
                            type: connectionType,
                            strength: connectionStrength,
                            label1: node1.data.label,
                            label2: node2.data.label,
                            key1: key1,
                            key2: key2
                        });
                    }
                }
            }
            
            // Sort connections by strength and limit total connections
            connections.sort((a, b) => b.strength - a.strength);
            const maxTotalConnections = Math.min(connections.length, 15); // Limit total connections
            const finalConnections = connections.slice(0, maxTotalConnections);
            
            // Update connection counts for final connections
            finalConnections.forEach(conn => {
                nodeConnectionCount.set(conn.key1, (nodeConnectionCount.get(conn.key1) || 0) + 1);
                nodeConnectionCount.set(conn.key2, (nodeConnectionCount.get(conn.key2) || 0) + 1);
            });
            
            // Draw enhanced connections
            finalConnections.forEach(conn => {
                // Use straight line instead of curved path for concept connections
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', conn.from.x);
                line.setAttribute('y1', conn.from.y);
                line.setAttribute('x2', conn.to.x);
                line.setAttribute('y2', conn.to.y);
                line.setAttribute('stroke', getConnectionColor(conn.type));
                line.setAttribute('stroke-width', Math.max(1, conn.strength * 3));
                line.setAttribute('stroke-dasharray', getConnectionPattern(conn.type));
                line.setAttribute('opacity', Math.max(0.3, conn.strength * 0.8));
                line.setAttribute('class', 'cross-connection visible');
                line.setAttribute('fill', 'none');
                
                // Store connection data for smart highlighting
                line.setAttribute('data-from-key', conn.key1);
                line.setAttribute('data-to-key', conn.key2);
                
                // Add connection title for debugging/info
                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = \`\${conn.type}: \${conn.label1} ↔ \${conn.label2} (\${(conn.strength * 100).toFixed(0)}%)\`;
                line.appendChild(title);
                
                crossConnectionsGroup.appendChild(line);
            });
        }
        
        // Enhanced similarity calculation functions
        function calculateSimilarity(text1, text2) {
            if (!text1 || !text2) return 0;
            
            const words1 = text1.toLowerCase().split(/\\s+/).filter(w => w.length > 2);
            const words2 = text2.toLowerCase().split(/\\s+/).filter(w => w.length > 2);
            
            if (words1.length === 0 || words2.length === 0) return 0;
            
            const shared = words1.filter(word => words2.includes(word));
            return shared.length / Math.max(words1.length, words2.length);
        }
        
        function calculateConceptualSimilarity(data1, data2) {
            const text1 = (data1.description || data1.label || '').toLowerCase();
            const text2 = (data2.description || data2.label || '').toLowerCase();
            
            const conceptWords = ['principle', 'theory', 'concept', 'idea', 'approach', 'method', 'technique', 'strategy', 'process', 'system'];
            const matches = conceptWords.filter(word => text1.includes(word) && text2.includes(word));
            
            return matches.length / conceptWords.length;
        }
        
        function calculateKeywordSimilarity(label1, label2) {
            const words1 = label1.toLowerCase().split(/\\s+/).filter(w => w.length > 3);
            const words2 = label2.toLowerCase().split(/\\s+/).filter(w => w.length > 3);
            
            const commonWords = words1.filter(word => words2.includes(word));
            return commonWords.length / Math.max(words1.length, words2.length, 1);
        }
        
        function calculateThemeConnection(data1, data2) {
            const themes = [
                ['leadership', 'management', 'authority', 'control'],
                ['social', 'community', 'relationship', 'interaction'],
                ['learning', 'education', 'knowledge', 'understanding'],
                ['emotion', 'feeling', 'psychology', 'mental'],
                ['action', 'behavior', 'conduct', 'practice'],
                ['influence', 'persuasion', 'impact', 'effect'],
                ['communication', 'language', 'expression', 'message']
            ];
            
            const text1 = (data1.description || data1.label || '').toLowerCase();
            const text2 = (data2.description || data2.label || '').toLowerCase();
            
            let maxThemeScore = 0;
            themes.forEach(theme => {
                const score1 = theme.filter(word => text1.includes(word)).length / theme.length;
                const score2 = theme.filter(word => text2.includes(word)).length / theme.length;
                const themeScore = Math.min(score1, score2) * 2; // Both must have theme words
                maxThemeScore = Math.max(maxThemeScore, themeScore);
            });
            
            return maxThemeScore;
        }
        
        function calculateProcessConnection(label1, label2) {
            const processWords = ['process', 'step', 'method', 'approach', 'technique', 'way', 'how to', 'strategy', 'practice', 'action'];
            const text1 = label1.toLowerCase();
            const text2 = label2.toLowerCase();
            
            const hasProcess1 = processWords.some(word => text1.includes(word));
            const hasProcess2 = processWords.some(word => text2.includes(word));
            
            if (hasProcess1 && hasProcess2) {
                return calculateSimilarity(label1, label2) * 1.5; // Boost process connections
            }
            
            return 0;
        }
        
        function calculateSemanticConnection(label1, label2) {
            // Semantic relationship words that often connect concepts
            const semanticRelations = [
                // Causality
                ['cause', 'effect', 'result', 'consequence', 'outcome', 'impact'],
                // Hierarchy
                ['parent', 'child', 'sub', 'main', 'primary', 'secondary'],
                // Time/sequence
                ['before', 'after', 'during', 'while', 'when', 'then', 'next'],
                // Comparison
                ['better', 'worse', 'more', 'less', 'same', 'different', 'similar'],
                // Dependency
                ['requires', 'needs', 'depends', 'relies', 'based', 'foundation'],
                // Function/purpose
                ['use', 'purpose', 'function', 'role', 'goal', 'aim', 'objective']
            ];
            
            const text1 = label1.toLowerCase();
            const text2 = label2.toLowerCase();
            
            let maxScore = 0;
            semanticRelations.forEach(relations => {
                const score1 = relations.filter(word => text1.includes(word)).length;
                const score2 = relations.filter(word => text2.includes(word)).length;
                if (score1 > 0 && score2 > 0) {
                    maxScore = Math.max(maxScore, (score1 + score2) / relations.length);
                }
            });
            
            return maxScore;
        }
        
        function calculateContrastConnection(label1, label2) {
            // Opposition/contrast pairs that create meaningful connections
            const oppositions = [
                ['positive', 'negative'], ['good', 'bad'], ['right', 'wrong'],
                ['active', 'passive'], ['strong', 'weak'], ['high', 'low'],
                ['increase', 'decrease'], ['growth', 'decline'], ['success', 'failure'],
                ['internal', 'external'], ['individual', 'group'], ['private', 'public'],
                ['theory', 'practice'], ['abstract', 'concrete'], ['general', 'specific'],
                ['formal', 'informal'], ['planned', 'spontaneous'], ['structured', 'flexible']
            ];
            
            const text1 = label1.toLowerCase();
            const text2 = label2.toLowerCase();
            
            for (const [word1, word2] of oppositions) {
                if ((text1.includes(word1) && text2.includes(word2)) || 
                    (text1.includes(word2) && text2.includes(word1))) {
                    return 0.8; // High score for clear oppositions
                }
            }
            
            return 0;
        }
        
        function getConnectionColor(type) {
            const colors = {
                'similar': '#60A5FA',     // Blue
                'conceptual': '#34D399',  // Green  
                'keyword': '#F59E0B',     // Amber
                'thematic': '#EC4899',    // Pink
                'process': '#8B5CF6',     // Purple
                'semantic': '#06B6D4',    // Cyan
                'contrast': '#EF4444'     // Red
            };
            return colors[type] || '#6B7280';
        }
        
        function getConnectionPattern(type) {
            const patterns = {
                'similar': '0',           // Solid
                'conceptual': '5,5',      // Dashed
                'keyword': '3,3',         // Short dashed
                'thematic': '8,3,3,3',    // Dash-dot
                'process': '2,2',         // Dotted
                'semantic': '6,2,2,2',    // Long dash-dot
                'contrast': '4,4,2,4'     // Complex dash for contrast
            };
            return patterns[type] || '0';
        }
        
        // Enhanced visual feedback functions with smart connection highlighting
        function highlightSelectedNode(nodeElement, nodeKey) {
            // Remove previous selection and reset connections
            clearNodeSelection();
            clearConnectedNodeHighlights();
            
            // Add primary selection styling
            nodeElement.style.filter = 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 16px rgba(255, 215, 0, 0.5))';
            nodeElement.style.strokeWidth = (parseInt(nodeElement.style.strokeWidth || nodeElement.getAttribute('stroke-width') || '2') + 1).toString();
            nodeElement.style.stroke = '#FFD700';
            nodeElement.style.transition = 'all 0.2s ease';
            
            selectedNode = nodeElement;
            
            // Handle smart connection highlighting if in connection mode
            if (connectionMode) {
                highlightConnectedNodes(nodeKey);
            }
        }
        
        function highlightConnectedNodes(selectedNodeKey) {
            if (!selectedNodeKey) return;
            
            const connections = document.querySelectorAll('.cross-connection');
            const connectedNodes = new Set();
            
            // First pass: find all connected nodes and hide non-relevant connections
            connections.forEach(connection => {
                const fromKey = connection.getAttribute('data-from-key');
                const toKey = connection.getAttribute('data-to-key');
                
                if (fromKey === selectedNodeKey || toKey === selectedNodeKey) {
                    // This connection is relevant - keep it visible and track connected nodes
                    connection.style.opacity = Math.max(0.6, parseFloat(connection.getAttribute('opacity') || '0.3'));
                    connection.style.strokeWidth = (parseFloat(connection.getAttribute('stroke-width') || '2') * 1.2).toString();
                    
                    // Add the connected node to our set
                    const connectedKey = fromKey === selectedNodeKey ? toKey : fromKey;
                    connectedNodes.add(connectedKey);
                } else {
                    // This connection is not relevant - fade it out
                    connection.style.opacity = '0.1';
                    connection.style.strokeWidth = '1';
                }
            });
            
            // Second pass: highlight the connected nodes with subtle styling
            connectedNodes.forEach(nodeKey => {
                const nodeElement = findNodeByKey(nodeKey);
                if (nodeElement) {
                    // Subtle highlight for connected nodes
                    nodeElement.style.filter = 'drop-shadow(0 0 4px #60A5FA) drop-shadow(0 0 8px rgba(96, 165, 250, 0.3))';
                    nodeElement.style.stroke = '#60A5FA';
                    nodeElement.style.strokeWidth = (parseInt(nodeElement.style.strokeWidth || nodeElement.getAttribute('stroke-width') || '2') + 0.5).toString();
                    nodeElement.style.transition = 'all 0.2s ease';
                    nodeElement.classList.add('connected-node-highlight');
                }
            });
        }
        
        function findNodeByKey(nodeKey) {
            // Look for nodes with matching data attributes
            const possibleSelectors = [
                \`[data-node-key="\${nodeKey}"]\`,
                \`[data-branch="\${nodeKey}"]\`,
                \`[data-concept="\${nodeKey}"]\`,
                \`[data-point="\${nodeKey}"]\`,
                \`[data-detail="\${nodeKey}"]\`
            ];
            
            for (const selector of possibleSelectors) {
                const element = document.querySelector(selector);
                if (element) return element;
            }
            
            return null;
        }
        
        function clearConnectedNodeHighlights() {
            // Reset all connection opacities and widths
            const connections = document.querySelectorAll('.cross-connection');
            connections.forEach(connection => {
                connection.style.opacity = connection.getAttribute('opacity') || '0.3';
                connection.style.strokeWidth = connection.getAttribute('stroke-width') || '2';
            });
            
            // Reset all connected node highlights
            const connectedNodes = document.querySelectorAll('.connected-node-highlight');
            connectedNodes.forEach(node => {
                node.style.filter = '';
                node.style.stroke = '';
                node.style.transition = '';
                
                // Reset to original stroke width based on node type
                if (node.classList.contains('center-node')) {
                    node.style.strokeWidth = '3';
                } else if (node.classList.contains('concept-node')) {
                    node.style.strokeWidth = '2';
                } else if (node.classList.contains('point-node')) {
                    node.style.strokeWidth = '1.5';
                } else if (node.classList.contains('detail-node')) {
                    node.style.strokeWidth = '1';
                } else if (node.classList.contains('main-branch')) {
                    node.style.strokeWidth = '2';
                }
                
                node.classList.remove('connected-node-highlight');
            });
        }
        
        function clearNodeSelection() {
            if (selectedNode) {
                selectedNode.style.filter = '';
                selectedNode.style.transition = '';
                selectedNode.style.stroke = ''; // Reset to original color
                
                // Reset to original stroke width based on node type
                if (selectedNode.classList.contains('center-node')) {
                    selectedNode.style.strokeWidth = '3';
                } else if (selectedNode.classList.contains('concept-node')) {
                    selectedNode.style.strokeWidth = '2';
                } else if (selectedNode.classList.contains('point-node')) {
                    selectedNode.style.strokeWidth = '1.5';
                } else if (selectedNode.classList.contains('detail-node')) {
                    selectedNode.style.strokeWidth = '1';
                } else if (selectedNode.classList.contains('main-branch')) {
                    selectedNode.style.strokeWidth = '2';
                }
            }
            
            // Also clear connected node highlights
            clearConnectedNodeHighlights();
            selectedNode = null;
        }
        
        // Collision detection and avoidance functions
        function checkCollision(x, y, radius, excludeKeys = []) {
            for (const [key, pos] of nodePositions) {
                if (excludeKeys.includes(key)) continue;
                
                const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                const minDistance = radius + pos.radius + LAYOUT.overlapBuffer;
                
                if (distance < minDistance) {
                    return true;
                }
            }
            return false;
        }

        function findNonCollidingPosition(baseX, baseY, baseAngle, radius, maxAttempts = 20) {
            // First try the base position
            if (!checkCollision(baseX, baseY, radius)) {
                return { x: baseX, y: baseY, angle: baseAngle };
            }

            // Try positions in a spiral pattern around the base position
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const spiralRadius = attempt * 25; // Spiral outward
                const angleVariations = 8 * attempt; // More positions per ring as we go out
                
                for (let angleIndex = 0; angleIndex < angleVariations; angleIndex++) {
                    const angle = baseAngle + (angleIndex / angleVariations) * 2 * Math.PI;
                    const x = baseX + Math.cos(angle) * spiralRadius;
                    const y = baseY + Math.sin(angle) * spiralRadius;
                    
                    if (!checkCollision(x, y, radius)) {
                        return { x, y, angle };
                    }
                }
            }

            // Fallback: return original position with a warning
            console.warn('Could not find non-colliding position, using original');
            return { x: baseX, y: baseY, angle: baseAngle };
        }

        function adjustPositionsForCollisions(positions) {
            const adjustedPositions = [];
            
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                const excludeKeys = adjustedPositions.map(p => p.key);
                
                // Check if this position collides with any already placed nodes
                const baseX = pos.x;
                const baseY = pos.y;
                const baseAngle = pos.angle;
                
                const adjustedPos = findNonCollidingPosition(baseX, baseY, baseAngle, pos.nodeRadius, 15);
                
                adjustedPositions.push({
                    ...pos,
                    x: adjustedPos.x,
                    y: adjustedPos.y,
                    angle: adjustedPos.angle
                });
                
                // Temporarily add to nodePositions for collision checking of subsequent nodes
                if (pos.key) {
                    nodePositions.set(pos.key, {
                        x: adjustedPos.x,
                        y: adjustedPos.y,
                        radius: pos.nodeRadius,
                        data: pos.data
                    });
                }
            }
            
            return adjustedPositions;
        }
        
        document.addEventListener('DOMContentLoaded', initializeMindMap);
    </script>
</body>
</html>`;
} 