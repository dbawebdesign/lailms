import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface BaseClassMindMapRequest {
  baseClassId: string;
}

interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main' | 'sub' | 'detail' | 'micro';
  children?: MindMapNode[];
  position?: { x: number; y: number };
  color?: string;
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  try {
    const { baseClassId } = await params;

    if (!baseClassId) {
      return NextResponse.json(
        { error: 'Base Class ID is required' },
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

    console.log('User authenticated:', { userId: user.id, email: user.email });

    // Debug: Check user's organization membership via profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, organisation_id')
      .eq('user_id', user.id);

    console.log('User profile check:', { 
      profileData, 
      profileError,
      userId: user.id 
    });

    // Debug: Check base class organization
    const { data: baseClassOrgData, error: baseClassOrgError } = await supabase
      .from('base_classes')
      .select('id, organisation_id')
      .eq('id', baseClassId);

    console.log('Base class organization check:', { 
      baseClassOrgData, 
      baseClassOrgError,
      baseClassId 
    });

    // Check if regeneration is requested
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';

    // Check if a mind map already exists for this base class
    const { data: existingAssets } = await supabase
      .from('base_class_media_assets')
      .select('*')
      .eq('base_class_id', baseClassId)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed');

    if (existingAssets && existingAssets.length > 0 && !regenerate) {
      return NextResponse.json(
        { error: 'A mind map already exists for this base class' },
        { status: 409 }
      );
    }

    // If regenerating, delete existing mind maps first
    if (regenerate && existingAssets && existingAssets.length > 0) {
      const { error: deleteError } = await supabase
        .from('base_class_media_assets')
        .delete()
        .eq('base_class_id', baseClassId)
        .eq('asset_type', 'mind_map');

      if (deleteError) {
        console.error('Failed to delete existing base class mind map:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete existing mind map' },
          { status: 500 }
        );
      }
    }

    // Fetch comprehensive base class data
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select(`
        id,
        name,
        description,
        settings,
        paths (
          id,
          title,
          description,
          order_index,
          lessons (
            id,
            title,
            description,
            order_index,
            lesson_sections (
              id,
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

    if (baseClassError) {
      console.error('Failed to fetch base class:', baseClassError);
      return NextResponse.json(
        { error: 'Failed to fetch base class details' },
        { status: 500 }
      );
    }

    if (!baseClass) {
      return NextResponse.json(
        { error: 'Base class not found' },
        { status: 404 }
      );
    }

    // Build comprehensive content from base class, paths, lessons, and sections
    let comprehensiveContent = '';

    // Add base class info
    if (baseClass.name) {
      comprehensiveContent += `Base Class: ${baseClass.name}\n\n`;
    }
    if (baseClass.description) {
      comprehensiveContent += `Description: ${baseClass.description}\n\n`;
    }

    // Add settings info
    if (baseClass.settings) {
      const settings = baseClass.settings as any;
      if (settings.subject) {
        comprehensiveContent += `Subject: ${settings.subject}\n`;
      }
      if (settings.gradeLevel) {
        comprehensiveContent += `Grade Level: ${settings.gradeLevel}\n`;
      }
      if (settings.generatedOutline) {
        comprehensiveContent += `Course Outline: ${JSON.stringify(settings.generatedOutline, null, 2)}\n\n`;
      }
    }

    // Add paths and lessons content
    if (baseClass.paths && baseClass.paths.length > 0) {
      comprehensiveContent += 'Course Structure:\n\n';
      
      baseClass.paths.forEach((path: any, pathIndex: number) => {
        comprehensiveContent += `Module ${pathIndex + 1}: ${path.title}\n`;
        if (path.description) {
          comprehensiveContent += `Description: ${path.description}\n`;
        }
        
        if (path.lessons && path.lessons.length > 0) {
          comprehensiveContent += `Lessons:\n`;
          
          path.lessons.forEach((lesson: any, lessonIndex: number) => {
            comprehensiveContent += `  Lesson ${lessonIndex + 1}: ${lesson.title}\n`;
            if (lesson.description) {
              comprehensiveContent += `  Objective: ${lesson.description}\n`;
            }
            
            if (lesson.lesson_sections && lesson.lesson_sections.length > 0) {
              comprehensiveContent += `  Content Sections:\n`;
              
              lesson.lesson_sections.forEach((section: any, sectionIndex: number) => {
                comprehensiveContent += `    Section ${sectionIndex + 1}: ${section.title}\n`;
                
                // Extract text content from JSONB
                const sectionText = extractTextFromContent(section.content);
                if (sectionText.trim()) {
                  // Limit section content to avoid overwhelming the AI
                  const truncatedText = sectionText.length > 500 
                    ? sectionText.substring(0, 500) + '...' 
                    : sectionText;
                  comprehensiveContent += `    Content: ${truncatedText}\n`;
                }
              });
            }
            comprehensiveContent += '\n';
          });
        }
        comprehensiveContent += '\n';
      });
    }

    if (!comprehensiveContent.trim()) {
      return NextResponse.json(
        { error: 'No content available to generate mind map' },
        { status: 400 }
      );
    }

    // Get grade level for appropriate language
    const gradeLevel = (baseClass.settings as any)?.gradeLevel || 'college';

    // Generate comprehensive mind map structure using OpenAI
    const prompt = `# Role and Objective
You are an expert educational designer creating a comprehensive, master mind map for an entire educational base class. This mind map should provide a complete visual overview of ALL content within the class, including modules, lessons, and key concepts. Your goal is to create a hierarchical, well-organized visualization that shows the full scope and structure of the educational program.

# Content Context
${comprehensiveContent}

# Critical Design Requirements for Base Class Mind Map

## Comprehensive Hierarchy & Structure
1. **Root Node**: Base class name (2-4 words maximum)
2. **Main Branches**: Course modules/paths (3-8 major learning areas)
3. **Sub-branches**: Individual lessons within each module (2-6 per module)
4. **Detail Level**: Key concepts and learning objectives from lessons (1-4 per lesson)
5. **Micro-details**: Specific topics or skills when content is rich (1-3 per concept)
6. **Complete Coverage**: Ensure ALL modules and lessons are represented

## Professional Styling Guidelines
- **Comprehensive**: Include all major content areas and learning objectives
- **Balanced**: Distribute content evenly across the visual space
- **Hierarchical**: Clear progression from course overview to specific topics
- **Educational**: Support understanding of the complete learning journey
- **Scalable**: Organized to handle extensive content without clutter

## Content Organization Rules
- **Root**: Base class title (e.g., "American History", "Biology Fundamentals")
- **Main Branches**: Course modules/units (e.g., "Colonial Period", "Revolutionary War")
- **Sub-branches**: Individual lessons (e.g., "Life in Jamestown", "Boston Tea Party")
- **Details**: Key learning objectives (e.g., "Economic Systems", "Political Tensions")
- **Micro-details**: Specific concepts (e.g., "Tobacco Trade", "Taxation Policies")
- **Language**: Student-friendly but academically appropriate for grade ${gradeLevel}

## Enhanced Color Scheme for Comprehensive Content
Use a rich, professional color palette that can handle extensive content:

Main Branch Colors (modules):
- "#2563EB" (Deep Blue) - Primary subjects
- "#10B981" (Emerald Green) - Science/Nature topics
- "#8B5CF6" (Purple) - Arts/Literature
- "#F59E0B" (Amber) - History/Social Studies
- "#EF4444" (Red) - Critical concepts
- "#06B6D4" (Cyan) - Technology/Modern topics
- "#84CC16" (Lime) - Health/Life skills
- "#F97316" (Orange) - Creative/Practical subjects

Sub-branch Colors (lessons):
- "#3B82F6" (Blue) - Lighter blue variants
- "#34D399" (Light Emerald)
- "#A78BFA" (Light Purple)
- "#FBBF24" (Light Amber)
- "#F87171" (Light Red)
- "#22D3EE" (Light Cyan)
- "#A3E635" (Light Lime)
- "#FB923C" (Light Orange)

Detail Colors (concepts):
- "#60A5FA" (Lighter blue)
- "#6EE7B7" (Very Light Emerald)
- "#C4B5FD" (Very Light Purple)
- "#FCD34D" (Very Light Amber)
- "#FCA5A5" (Very Light Red)
- "#67E8F9" (Very Light Cyan)
- "#BEF264" (Very Light Lime)
- "#FDBA74" (Very Light Orange)

## JSON Structure Requirements
Return ONLY valid JSON in this exact format, ensuring comprehensive coverage:

\`\`\`json
{
  "root": {
    "id": "root",
    "label": "Base Class Name",
    "type": "root",
    "color": "#1E40AF",
    "children": [
      {
        "id": "module1",
        "label": "Module/Path 1",
        "type": "main",
        "color": "#2563EB",
        "children": [
          {
            "id": "lesson1_1",
            "label": "Lesson Title",
            "type": "sub",
            "color": "#3B82F6",
            "children": [
              {
                "id": "concept1_1_1",
                "label": "Key Concept",
                "type": "detail",
                "color": "#60A5FA",
                "children": [
                  {
                    "id": "micro1_1_1_1",
                    "label": "Specific Topic",
                    "type": "micro",
                    "color": "#93C5FD"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "title": "Comprehensive Base Class Mind Map"
}
\`\`\`

# Quality Standards for Base Class Mind Maps
- **Comprehensive**: Include ALL modules, lessons, and major concepts
- **Organized**: Logical flow from general course structure to specific topics
- **Balanced**: Even distribution of content across all modules
- **Educational**: Clear learning progression and relationships
- **Professional**: Suitable for educational presentations and course overviews
- **Complete**: Represent the full scope of the educational program

# Output Requirements
- Return ONLY valid JSON, no additional text or formatting
- Use the exact color codes provided above
- Ensure all node IDs are unique and descriptive
- Keep labels concise but informative (2-6 words per label)
- Maintain the exact JSON structure specified
- Include ALL content from the base class, modules, and lessons
- Create a comprehensive educational overview tool`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a premium educational designer specializing in comprehensive mind maps for entire educational programs. Your designs provide complete visual overviews of educational content, showing the full scope and structure of learning programs. You create hierarchical visualizations that help educators and students understand the complete learning journey.

# Core Design Principles
- **Comprehensive Coverage**: Include ALL content areas and learning objectives
- **Educational Hierarchy**: Clear progression from course overview to specific concepts
- **Visual Organization**: Logical structure that supports learning comprehension
- **Professional Quality**: Suitable for educational institutions and presentations
- **Scalable Design**: Handle extensive content without visual clutter

# Critical Requirements
- Return ONLY valid JSON, no additional text, markdown, or explanations
- Use EXACT color codes as specified in the prompt
- Create comprehensive coverage of all course content
- Ensure perfect balance and logical organization
- Maintain consistent styling across all elements
- Focus on educational value and complete program overview
- NEVER include explanatory text or formatting - JSON ONLY`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const mindMapData = completion.choices[0]?.message?.content;
    if (!mindMapData) {
      throw new Error('Failed to generate base class mind map structure');
    }

    let parsedMindMap;
    try {
      // Clean the response and extract JSON
      let cleanedData = mindMapData.trim();
      
      // Remove any markdown code blocks if present
      cleanedData = cleanedData.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      
      // Try to find JSON object in the response
      const jsonMatch = cleanedData.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedData = jsonMatch[0];
      }
      
      console.log('Attempting to parse base class mind map JSON:', cleanedData.substring(0, 500));
      parsedMindMap = JSON.parse(cleanedData);
      
      // Validate the structure
      if (!parsedMindMap.root || !parsedMindMap.title) {
        throw new Error('Base class mind map missing required root or title');
      }
      
    } catch (e) {
      console.error('Failed to parse base class mind map JSON:', e);
      console.error('Raw response:', mindMapData);
      throw new Error('Invalid base class mind map structure generated');
    }

    // Generate interactive HTML mind map using the same function as lesson mind maps
    const htmlContent = generateInteractiveMindMap(parsedMindMap.root, parsedMindMap.title);

    // Calculate statistics safely
    const pathsCount = baseClass.paths?.length || 0;
    const lessonsCount = baseClass.paths?.reduce((total: number, path: any) => {
      return total + (path.lessons?.length || 0);
    }, 0) || 0;
    const sectionsCount = baseClass.paths?.reduce((total: number, path: any) => {
      return total + (path.lessons?.reduce((lessonTotal: number, lesson: any) => {
        return lessonTotal + (lesson.lesson_sections?.length || 0);
      }, 0) || 0);
    }, 0) || 0;

    // Save the mind map asset to the database
    const insertData = {
      base_class_id: baseClassId,
      asset_type: 'mind_map',
      title: parsedMindMap.title || 'Base Class Mind Map',
      content: {
        ...parsedMindMap,
        paths_count: pathsCount,
        lessons_count: lessonsCount,
        sections_count: sectionsCount,
        comprehensive_content_length: comprehensiveContent.length
      },
      svg_content: htmlContent,
      status: 'completed',
      created_by: user.id
    };

    console.log('Attempting to insert base class mind map with data:', {
      base_class_id: insertData.base_class_id,
      asset_type: insertData.asset_type,
      title: insertData.title,
      content_keys: Object.keys(insertData.content),
      svg_content_length: insertData.svg_content.length,
      status: insertData.status,
      created_by: insertData.created_by
    });

    const { data: assetData, error: assetError } = await supabase
      .from('base_class_media_assets')
      .insert(insertData)
      .select()
      .single();

    if (assetError) {
      console.error('Database error details:', {
        error: assetError,
        message: assetError.message,
        details: assetError.details,
        hint: assetError.hint,
        code: assetError.code
      });
      throw new Error(`Failed to save base class mind map: ${assetError.message || 'Unknown database error'}`);
    }

    // Generate a public URL for the mind map
    const mindMapUrl = `/api/teach/media/base-class-mind-map/${assetData.id}`;

    return NextResponse.json({
      success: true,
      asset: {
        id: assetData.id,
        type: 'mind_map',
        title: assetData.title,
        url: mindMapUrl,
        status: 'completed',
        createdAt: assetData.created_at
      }
    });

  } catch (error) {
    console.error('Base class mind map generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate base class mind map. Please try again.' },
      { status: 500 }
    );
  }
}

// Import the mind map generation function from the lesson mind map route
function generateInteractiveMindMap(rootNode: MindMapNode, title: string): string {
  // This would be the same function as in the lesson mind map route
  // For now, I'll import it or duplicate it here
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            color: white;
            overflow: hidden;
            height: 100vh;
            margin: 0;
            padding: 0;
            font-feature-settings: 'kern' 1, 'liga' 1;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .mind-map-container {
            position: relative;
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        
        #mindMap {
            position: relative;
            width: 100%;
            height: 100%;
            transform-origin: center center;
            transition: transform 0.3s ease;
        }
        
        .mind-map-title {
            position: absolute;
            top: 32px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            z-index: 10;
            text-align: center;
            letter-spacing: -0.025em;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            max-width: 80%;
            line-height: 1.2;
        }
        
        .mind-map-node {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            font-weight: 600;
            text-align: center;
            border: 2px solid rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            user-select: none;
            padding: 12px 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
            letter-spacing: -0.01em;
            line-height: 1.3;
            word-wrap: break-word;
            hyphens: auto;
            min-width: 80px;
            max-width: 280px;
            white-space: normal;
            overflow: visible;
        }
        
        .mind-map-node:hover {
            transform: scale(1.05) translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
            z-index: 100;
        }
        
        .root-node {
            background: linear-gradient(135deg, #1E40AF 0%, #1d4ed8 100%);
            font-size: 18px;
            font-weight: 700;
            z-index: 5;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(30, 64, 175, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
            min-width: 160px;
            min-height: 160px;
            max-width: 240px;
            max-height: 240px;
            padding: 20px;
        }
        
        .main-node {
            font-size: 14px;
            border-radius: 20px;
            z-index: 4;
            position: relative;
            min-width: 120px;
            max-width: 220px;
            min-height: 40px;
            padding: 12px 16px;
        }
        
        .sub-node {
            font-size: 12px;
            border-radius: 16px;
            z-index: 3;
            opacity: 0;
            transform: scale(0);
            min-width: 100px;
            max-width: 180px;
            min-height: 32px;
            padding: 8px 12px;
        }
        
        .sub-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .detail-node {
            font-size: 11px;
            border-radius: 14px;
            z-index: 2;
            opacity: 0;
            transform: scale(0);
            min-width: 90px;
            max-width: 160px;
            min-height: 30px;
            padding: 6px 10px;
        }
        
        .detail-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .micro-node {
            font-size: 10px;
            border-radius: 12px;
            z-index: 1;
            opacity: 0;
            transform: scale(0);
            min-width: 70px;
            max-width: 120px;
            min-height: 26px;
            padding: 4px 8px;
        }
        
        .micro-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .connection-line {
            position: absolute;
            transform-origin: left center;
            z-index: 1;
            height: 3px;
            border-radius: 1.5px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        .connection-line.primary {
            background: linear-gradient(90deg, rgba(37, 99, 235, 0.8) 0%, rgba(37, 99, 235, 0.3) 100%);
            height: 4px;
        }
        
        .connection-line.secondary {
            background: linear-gradient(90deg, rgba(16, 185, 129, 0.6) 0%, rgba(16, 185, 129, 0.2) 100%);
            height: 3px;
        }
        
        .connection-line.tertiary {
            background: linear-gradient(90deg, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.15) 100%);
            height: 2px;
        }
        
        .connection-line.related {
            background: linear-gradient(90deg, rgba(245, 158, 11, 0.6) 0%, rgba(245, 158, 11, 0.2) 100%);
            height: 2px;
            stroke-dasharray: 5,5;
            border-top: 2px dashed rgba(245, 158, 11, 0.4);
            background: none;
        }
        
        .sub-connection-line {
            height: 2px;
            background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 100%);
            opacity: 0;
            transition: opacity 0.4s ease;
            border-radius: 1px;
        }
        
        .sub-connection-line.visible {
            opacity: 1;
        }
        
        .expand-indicator {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 14px;
            transition: transform 0.3s ease;
            opacity: 0.7;
        }
        
        .expand-indicator.expanded {
            transform: translateY(-50%) rotate(90deg);
        }
        
        .controls {
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 40;
        }
        
        .control-group {
            display: flex;
            gap: 4px;
            background: rgba(0, 0, 0, 0.3);
            padding: 4px;
            border-radius: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .control-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            font-size: 12px;
            min-width: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .control-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }
        
        .control-btn.active {
            background: rgba(37, 99, 235, 0.3);
            border-color: rgba(37, 99, 235, 0.5);
        }
        
        .help-text {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            max-width: 300px;
        }
        
        @media (max-width: 768px) {
            .mind-map-title {
                font-size: 20px;
                top: 16px;
            }
            
            .controls {
                bottom: 10px;
                right: 10px;
                scale: 0.9;
            }
            
            .help-text {
                bottom: 10px;
                left: 10px;
                font-size: 11px;
                padding: 8px 12px;
                max-width: 250px;
            }
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <h1 class="mind-map-title">${title}</h1>
        
        <div class="controls">
            <div class="control-group">
                <button class="control-btn" id="zoomIn" title="Zoom In">🔍+</button>
                <button class="control-btn" id="zoomOut" title="Zoom Out">🔍-</button>
                <button class="control-btn" id="resetView" title="Reset View">⌂</button>
            </div>
            <div class="control-group">
                <button class="control-btn" id="expandAll" title="Expand All">⤢</button>
                <button class="control-btn" id="collapseAll" title="Collapse All">⤡</button>
            </div>
        </div>
        
        <div class="help-text">
            <div style="font-weight: 600; margin-bottom: 8px;">Base Class Overview</div>
            <div style="font-size: 11px; opacity: 0.8;">
                Click nodes to expand • Drag to pan • Scroll to zoom<br>
                Complete course structure with all modules and lessons
            </div>
        </div>
        
        <div id="mindMap"></div>
    </div>
    
    <script>
        const mindMapData = ${JSON.stringify(rootNode)};
        let currentZoom = 1;
        let expandedNodes = new Set();
        let nodePositions = new Map();
        
        // Simplified version for base class mind maps
        function createMindMap() {
            const container = document.getElementById('mindMap');
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            container.innerHTML = '';
            nodePositions.clear();
            
            // Create root node
            const rootNode = createNode(mindMapData, 'root-node', centerX - 120, centerY - 80, 240, 160);
            container.appendChild(rootNode);
            nodePositions.set(mindMapData.id, { 
                x: centerX, 
                y: centerY, 
                element: rootNode,
                type: 'root'
            });
            
            // Create main branches
            if (mindMapData.children) {
                const angleStep = (2 * Math.PI) / mindMapData.children.length;
                const distance = 350;
                
                mindMapData.children.forEach((child, index) => {
                    const angle = -Math.PI / 2 + index * angleStep;
                    const x = centerX + Math.cos(angle) * distance - 110;
                    const y = centerY + Math.sin(angle) * distance - 25;
                    
                    const line = createConnectionLine(centerX, centerY, x + 110, y + 25, 'primary');
                    container.appendChild(line);
                    
                    const mainNode = createNode(child, 'main-node', x, y, 220, 50);
                    if (child.children && child.children.length > 0) {
                        const indicator = document.createElement('span');
                        indicator.className = 'expand-indicator';
                        indicator.textContent = '▶';
                        mainNode.appendChild(indicator);
                        
                        mainNode.addEventListener('click', () => toggleSubNodes(child, x + 110, y + 25, angle, mainNode));
                    }
                    container.appendChild(mainNode);
                    
                    nodePositions.set(child.id, { 
                        x: x + 110, 
                        y: y + 25, 
                        element: mainNode,
                        type: child.type
                    });
                });
            }
        }
        
        function createNode(nodeData, className, x, y, width, height) {
            const node = document.createElement('div');
            node.className = \`mind-map-node \${className}\`;
            node.style.left = x + 'px';
            node.style.top = y + 'px';
            node.style.width = width + 'px';
            node.style.height = height + 'px';
            node.textContent = nodeData.label;
            node.setAttribute('data-id', nodeData.id);
            
            if (nodeData.color) {
                node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -15)} 100%)\`;
            }
            
            return node;
        }
        
        function createConnectionLine(x1, y1, x2, y2, type = 'primary') {
            const line = document.createElement('div');
            line.className = \`connection-line \${type}\`;
            
            const deltaX = x2 - x1;
            const deltaY = y2 - y1;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            line.style.width = length + 'px';
            line.style.left = x1 + 'px';
            line.style.top = y1 + 'px';
            line.style.transform = \`rotate(\${angle}deg)\`;
            
            return line;
        }
        
        function toggleSubNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            // Simplified expansion for base class mind maps
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            
            if (isExpanded) {
                // Hide sub-nodes
                parentNode.children.forEach(child => {
                    const subNode = document.querySelector(\`[data-id="\${child.id}"]\`);
                    if (subNode) {
                        subNode.remove();
                        nodePositions.delete(child.id);
                    }
                });
                indicator.classList.remove('expanded');
            } else {
                // Show sub-nodes
                const subDistance = 200;
                const angleSpread = Math.PI / 3;
                const startAngle = parentAngle - angleSpread / 2;
                
                parentNode.children.forEach((child, index) => {
                    const angle = startAngle + (index * angleSpread / Math.max(1, parentNode.children.length - 1));
                    const x = parentX + Math.cos(angle) * subDistance - 90;
                    const y = parentY + Math.sin(angle) * subDistance - 20;
                    
                    const subLine = createConnectionLine(parentX, parentY, x + 90, y + 20, 'secondary');
                    document.getElementById('mindMap').appendChild(subLine);
                    
                    const subNode = createNode(child, 'sub-node', x, y, 180, 40);
                    subNode.classList.add('visible');
                    document.getElementById('mindMap').appendChild(subNode);
                    
                    nodePositions.set(child.id, {
                        x: x + 90,
                        y: y + 20,
                        element: subNode,
                        type: child.type
                    });
                });
                indicator.classList.add('expanded');
            }
        }
        
        function adjustBrightness(hex, percent) {
            hex = hex.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            const newR = Math.max(0, Math.min(255, r + (r * percent / 100)));
            const newG = Math.max(0, Math.min(255, g + (g * percent / 100)));
            const newB = Math.max(0, Math.min(255, b + (b * percent / 100)));
            
            return '#' + 
                Math.round(newR).toString(16).padStart(2, '0') +
                Math.round(newG).toString(16).padStart(2, '0') +
                Math.round(newB).toString(16).padStart(2, '0');
        }
        
        // Control functions
        document.getElementById('zoomIn').addEventListener('click', () => {
            currentZoom = Math.min(currentZoom * 1.2, 3);
            applyZoom();
        });
        
        document.getElementById('zoomOut').addEventListener('click', () => {
            currentZoom = Math.max(currentZoom / 1.2, 0.3);
            applyZoom();
        });
        
        document.getElementById('resetView').addEventListener('click', () => {
            currentZoom = 1;
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = 'scale(1) translate(0, 0)';
        });
        
        document.getElementById('expandAll').addEventListener('click', () => {
            const mainNodes = document.querySelectorAll('.main-node');
            mainNodes.forEach(node => {
                const indicator = node.querySelector('.expand-indicator');
                if (indicator && !indicator.classList.contains('expanded')) {
                    node.click();
                }
            });
        });
        
        document.getElementById('collapseAll').addEventListener('click', () => {
            const mainNodes = document.querySelectorAll('.main-node');
            mainNodes.forEach(node => {
                const indicator = node.querySelector('.expand-indicator');
                if (indicator && indicator.classList.contains('expanded')) {
                    node.click();
                }
            });
        });
        
        function applyZoom() {
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = \`scale(\${currentZoom})\`;
        }
        
        // Mouse wheel zoom
        document.addEventListener('wheel', (e) => {
            if (e.target.closest('.mind-map-container')) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    currentZoom = Math.min(currentZoom * 1.1, 3);
                } else {
                    currentZoom = Math.max(currentZoom / 1.1, 0.3);
                }
                applyZoom();
            }
        });
        
        // Initialize mind map
        createMindMap();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            document.getElementById('mindMap').innerHTML = '';
            createMindMap();
        });
    </script>
</body>
</html>`;
}

// GET method to check for existing base class mind maps
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  try {
    const { baseClassId } = await params;

    if (!baseClassId) {
      return NextResponse.json(
        { error: 'Base Class ID is required' },
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

    // Check for existing mind map
    const { data: existingAssets, error: assetsError } = await supabase
      .from('base_class_media_assets')
      .select('id, title, created_at')
      .eq('base_class_id', baseClassId)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (assetsError) {
      console.error('Failed to fetch existing base class mind maps:', assetsError);
      return NextResponse.json(
        { error: 'Failed to check for existing mind maps' },
        { status: 500 }
      );
    }

    if (existingAssets && existingAssets.length > 0) {
      const asset = existingAssets[0];
      const mindMapUrl = `/api/teach/media/base-class-mind-map/${asset.id}`;
      
      return NextResponse.json({
        exists: true,
        asset: {
          id: asset.id,
          title: asset.title,
          url: mindMapUrl,
          createdAt: asset.created_at
        }
      });
    } else {
      return NextResponse.json({
        exists: false,
        asset: null
      });
    }

  } catch (error) {
    console.error('Error checking for existing base class mind map:', error);
    return NextResponse.json(
      { error: 'Failed to check for existing mind map' },
      { status: 500 }
    );
  }
} 