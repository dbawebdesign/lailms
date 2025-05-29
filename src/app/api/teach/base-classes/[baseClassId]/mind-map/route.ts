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
    const prompt = `Create a comprehensive mind map for this educational base class. Return ONLY valid JSON.

CONTENT:
${comprehensiveContent}

REQUIREMENTS:
- Grade level: ${gradeLevel}
- 5-level hierarchy: Root → Modules → Lessons → Concepts → Details
- Professional color scheme with semantic meaning
- Complete coverage of all course content

STRUCTURE:
Root: Base class title (2-4 words)
Main branches: Course modules/paths (3-8 major areas)
Sub-branches: Individual lessons (2-6 per module)
Details: Key concepts (1-4 per lesson)
Micro-details: Specific topics (1-3 per concept)

COLORS (use exactly):
Main: ["#2563EB", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#84CC16", "#F97316"]
Sub: ["#3B82F6", "#34D399", "#A78BFA", "#FBBF24", "#F87171", "#22D3EE", "#A3E635", "#FB923C"]
Detail: ["#60A5FA", "#6EE7B7", "#C4B5FD", "#FCD34D", "#FCA5A5", "#67E8F9", "#BEF264", "#FDBA74"]

JSON FORMAT:
{
  "root": {
    "id": "root",
    "label": "Course Title",
    "type": "root",
    "color": "#1E40AF",
    "children": [
      {
        "id": "mod1",
        "label": "Module Name",
        "type": "main",
        "color": "#2563EB",
        "children": [
          {
            "id": "les1_1",
            "label": "Lesson Title",
            "type": "sub",
            "color": "#3B82F6",
            "children": [
              {
                "id": "con1_1_1",
                "label": "Key Concept",
                "type": "detail",
                "color": "#60A5FA"
              }
            ]
          }
        ]
      }
    ]
  },
  "title": "Base Class Mind Map"
}

CONSTRAINTS:
- Maximum 4 levels deep
- Labels: 2-6 words each
- Include ALL modules and lessons
- Use exact color codes provided
- Return only JSON, no explanations`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are an educational mind map designer. Create comprehensive visual overviews of educational programs using hierarchical JSON structures.

CORE PRINCIPLES:
- Complete coverage of all course content
- Clear educational hierarchy and progression  
- Professional visual organization
- Student-appropriate language

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON, no explanations
- Use EXACT color codes from prompt
- Ensure proper JSON structure with all brackets closed
- Maximum 4 levels deep to avoid complexity
- Include ALL course modules and lessons
- Keep labels concise (2-6 words)`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 12000,
      temperature: 0.3,
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
      
      // Advanced JSON repair for truncated responses
      if (!cleanedData.endsWith('}')) {
        console.log('JSON appears truncated, attempting advanced repair...');
        
        // Find the last complete object or array
        let lastValidPosition = cleanedData.length;
        let braceCount = 0;
        let bracketCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = cleanedData.length - 1; i >= 0; i--) {
          const char = cleanedData[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '}') braceCount++;
            else if (char === '{') braceCount--;
            else if (char === ']') bracketCount++;
            else if (char === '[') bracketCount--;
            
            // If we have balanced braces and brackets, this might be a good cut point
            if (braceCount === 0 && bracketCount === 0) {
              lastValidPosition = i;
              break;
            }
          }
        }
        
        // Try to repair by cutting at the last valid position
        if (lastValidPosition < cleanedData.length) {
          cleanedData = cleanedData.substring(0, lastValidPosition);
          
          // Add missing closing braces/brackets
          const openBraces = (cleanedData.match(/\{/g) || []).length;
          const closeBraces = (cleanedData.match(/\}/g) || []).length;
          const openBrackets = (cleanedData.match(/\[/g) || []).length;
          const closeBrackets = (cleanedData.match(/\]/g) || []).length;
          
          const missingBraces = openBraces - closeBraces;
          const missingBrackets = openBrackets - closeBrackets;
          
          if (missingBrackets > 0) {
            cleanedData += ']'.repeat(missingBrackets);
          }
          if (missingBraces > 0) {
            cleanedData += '}'.repeat(missingBraces);
          }
          
          console.log(`Repaired JSON: cut at position ${lastValidPosition}, added ${missingBrackets} brackets and ${missingBraces} braces`);
        }
        
        // Remove any trailing commas that might cause issues
        cleanedData = cleanedData.replace(/,(\s*[}\]])/g, '$1');
        
        // Remove incomplete property names or values at the end
        cleanedData = cleanedData.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*"?\s*$/, '');
        cleanedData = cleanedData.replace(/,\s*"[^"]*"?\s*$/, '');
      }
      
      console.log('Attempting to parse base class mind map JSON:', cleanedData.substring(0, 500));
      console.log('JSON ends with:', cleanedData.slice(-100));
      
      parsedMindMap = JSON.parse(cleanedData);
      
      // Validate the structure
      if (!parsedMindMap.root || !parsedMindMap.title) {
        throw new Error('Base class mind map missing required root or title');
      }
      
    } catch (e: unknown) {
      console.error('Failed to parse base class mind map JSON:', e);
      console.error('Raw response length:', mindMapData.length);
      console.error('Raw response (first 1000 chars):', mindMapData.substring(0, 1000));
      console.error('Raw response (last 500 chars):', mindMapData.slice(-500));
      
      // If parsing still failed, create a simplified fallback structure
      const errorMessage = e instanceof Error ? e.message : 'Unknown parsing error';
      
      // Try to create a minimal valid structure as fallback
      console.log('Creating fallback mind map structure...');
      parsedMindMap = {
        root: {
          id: "root",
          label: baseClass.name || "Base Class",
          type: "root",
          color: "#1E40AF",
          children: baseClass.paths?.slice(0, 6).map((path: any, index: number) => ({
            id: `mod${index + 1}`,
            label: path.title.substring(0, 20),
            type: "main",
            color: ["#2563EB", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"][index % 6],
            children: path.lessons?.slice(0, 4).map((lesson: any, lessonIndex: number) => ({
              id: `les${index + 1}_${lessonIndex + 1}`,
              label: lesson.title.substring(0, 20),
              type: "sub",
              color: ["#3B82F6", "#34D399", "#A78BFA", "#FBBF24"][lessonIndex % 4]
            })) || []
          })) || []
        },
        title: `${baseClass.name} Mind Map`
      };
      
      console.log('Using fallback structure with', parsedMindMap.root.children.length, 'modules');
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
    const mindMapUrl = '/api/teach/media/base-class-mind-map/' + assetData.id;

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
            cursor: grab;
        }
        
        .mind-map-container:active {
            cursor: grabbing;
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
            padding: 20px;
        }
        
        .main-node {
            font-size: 14px;
            border-radius: 20px;
            z-index: 4;
            position: relative;
            padding: 12px 16px;
        }
        
        .sub-node {
            font-size: 12px;
            border-radius: 16px;
            z-index: 3;
            opacity: 0;
            transform: scale(0);
            padding: 10px 14px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sub-node.visible {
            opacity: 1;
            transform: scale(1);
        }
        
        .detail-node {
            font-size: 11px;
            border-radius: 14px;
            z-index: 2;
            opacity: 0;
            transform: scale(0);
            padding: 8px 12px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .detail-node.visible {
            opacity: 1;
            transform: scale(1);
        }
        
        .connection-line {
            position: absolute;
            transform-origin: left center;
            z-index: 1;
            height: 3px;
            border-radius: 1.5px;
            background: linear-gradient(90deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.1) 100%);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        .sub-connection {
            height: 2px;
            background: linear-gradient(90deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.08) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .sub-connection.visible {
            opacity: 1;
        }
        
        .detail-connection {
            height: 1px;
            background: linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.05) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .detail-connection.visible {
            opacity: 1;
        }
        
        .expand-indicator {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
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
            max-width: 280px;
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
                max-width: 220px;
            }
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <h1 class="mind-map-title">${title}</h1>
        
        <!-- Simplified Controls -->
        <div class="controls">
            <div class="control-group">
                <button id="zoomIn" class="control-btn" title="Zoom In">+</button>
                <button id="zoomOut" class="control-btn" title="Zoom Out">−</button>
                <button id="resetView" class="control-btn" title="Reset View">⌂</button>
            </div>
            <div class="control-group">
                <button id="expandAll" class="control-btn" title="Expand All">⊞</button>
                <button id="collapseAll" class="control-btn" title="Collapse All">⊟</button>
            </div>
        </div>
        
        <!-- Clean Help Text -->
        <div class="help-text">
            <div style="font-weight: 600; margin-bottom: 8px;">Course Overview</div>
            <div style="font-size: 11px; opacity: 0.8;">
                <strong>Navigate:</strong> Click to expand • Drag to pan • Scroll to zoom<br>
                <strong>Structure:</strong> Course → Modules → Lessons → Concepts
            </div>
        </div>
        
        <div id="mindMap"></div>
    </div>
    
    <script>
        const mindMapData = ${JSON.stringify(rootNode)};
        let currentZoom = 1;
        let expandedNodes = new Set();
        let nodePositions = new Map();
        
        // Drag and pan variables
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let currentTransform = { x: 0, y: 0 };
        
        // Clean layout configuration
        const LAYOUT_CONFIG = {
            MAIN_RADIUS: 300,
            SUB_RADIUS: 200,
            DETAIL_RADIUS: 140,
            ANGLE_SPREAD: Math.PI * 1.4, // 252 degrees
        };
        
        function measureText(text, fontSize = 14, maxWidth = 200) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = \`600 \${fontSize}px Inter, sans-serif\`;
            
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0] || '';
            
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + ' ' + words[i];
                const metrics = context.measureText(testLine);
                if (metrics.width > maxWidth - 32) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);
            
            const width = Math.max(
                Math.min(maxWidth, Math.max(...lines.map(line => context.measureText(line).width)) + 32),
                100
            );
            const height = Math.max(lines.length * (fontSize * 1.4) + 16, 40);
            
            return { width, height };
        }
        
        function createMindMap() {
            const container = document.getElementById('mindMap');
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            container.innerHTML = '';
            nodePositions.clear();
            expandedNodes.clear();
            
            // Create root node
            const rootSize = measureText(mindMapData.label, 18, 280);
            const rootWidth = Math.max(rootSize.width, 180);
            const rootHeight = Math.max(rootSize.height, 180);
            
            const rootElement = createNode(
                mindMapData, 
                'root-node', 
                centerX - rootWidth/2, 
                centerY - rootHeight/2, 
                rootWidth, 
                rootHeight
            );
            container.appendChild(rootElement);
            
            nodePositions.set(mindMapData.id, { 
                x: centerX, 
                y: centerY, 
                width: rootWidth,
                height: rootHeight,
                element: rootElement
            });
            
            // Layout main nodes
            if (mindMapData.children && mindMapData.children.length > 0) {
                layoutMainNodes(mindMapData.children, centerX, centerY);
            }
        }
        
        function layoutMainNodes(children, centerX, centerY) {
            const container = document.getElementById('mindMap');
            const angleStep = LAYOUT_CONFIG.ANGLE_SPREAD / Math.max(children.length - 1, 1);
            const startAngle = -LAYOUT_CONFIG.ANGLE_SPREAD / 2;
            
            children.forEach((child, index) => {
                const angle = children.length === 1 ? 0 : startAngle + (index * angleStep);
                
                const nodeSize = measureText(child.label, 14, 220);
                const nodeWidth = nodeSize.width;
                const nodeHeight = Math.max(nodeSize.height, 50);
                
                const nodeX = centerX + Math.cos(angle) * LAYOUT_CONFIG.MAIN_RADIUS - nodeWidth/2;
                const nodeY = centerY + Math.sin(angle) * LAYOUT_CONFIG.MAIN_RADIUS - nodeHeight/2;
                const nodeCenterX = nodeX + nodeWidth/2;
                const nodeCenterY = nodeY + nodeHeight/2;
                
                // Create connection line
                const line = createConnectionLine(centerX, centerY, nodeCenterX, nodeCenterY);
                container.appendChild(line);
                
                // Create the node
                const nodeElement = createNode(child, 'main-node', nodeX, nodeY, nodeWidth, nodeHeight);
                
                if (child.children && child.children.length > 0) {
                    const indicator = document.createElement('span');
                    indicator.className = 'expand-indicator';
                    indicator.textContent = '▶';
                    nodeElement.appendChild(indicator);
                    
                    nodeElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleSubNodes(child, nodeCenterX, nodeCenterY, angle, nodeElement);
                    });
                }
                
                container.appendChild(nodeElement);
                
                nodePositions.set(child.id, { 
                    x: nodeCenterX,
                    y: nodeCenterY,
                    width: nodeWidth,
                    height: nodeHeight,
                    element: nodeElement,
                    angle: angle
                });
            });
        }
        
        function toggleSubNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            const container = document.getElementById('mindMap');
            
            if (isExpanded) {
                // Collapse
                expandedNodes.delete(parentNode.id);
                
                // Remove sub-nodes and their connections
                parentNode.children.forEach(child => {
                    const subElement = document.querySelector(\`[data-id="\${child.id}"]\`);
                    const connections = document.querySelectorAll(\`[data-parent="\${parentNode.id}"]\`);
                    
                    if (subElement) {
                        subElement.classList.remove('visible');
                        setTimeout(() => subElement.remove(), 300);
                        nodePositions.delete(child.id);
                    }
                    
                    connections.forEach(conn => {
                        conn.classList.remove('visible');
                        setTimeout(() => conn.remove(), 300);
                    });
                });
                
                indicator.classList.remove('expanded');
                indicator.textContent = '▶';
            } else {
                // Expand
                expandedNodes.add(parentNode.id);
                layoutSubNodes(parentNode.children, parentX, parentY, parentAngle, parentNode.id);
                indicator.classList.add('expanded');
                indicator.textContent = '▼';
            }
        }
        
        function layoutSubNodes(children, parentX, parentY, parentAngle, parentId) {
            const container = document.getElementById('mindMap');
            const subAngleSpread = Math.PI * 0.6; // 108 degrees
            const startAngle = parentAngle - subAngleSpread / 2;
            
            children.forEach((child, index) => {
                const angle = children.length === 1 ? 
                    parentAngle : 
                    startAngle + (index * subAngleSpread / (children.length - 1));
                
                const nodeSize = measureText(child.label, 12, 180);
                const nodeWidth = nodeSize.width;
                const nodeHeight = Math.max(nodeSize.height, 40);
                
                const nodeX = parentX + Math.cos(angle) * LAYOUT_CONFIG.SUB_RADIUS - nodeWidth/2;
                const nodeY = parentY + Math.sin(angle) * LAYOUT_CONFIG.SUB_RADIUS - nodeHeight/2;
                const nodeCenterX = nodeX + nodeWidth/2;
                const nodeCenterY = nodeY + nodeHeight/2;
                
                // Create connection line
                const line = createConnectionLine(parentX, parentY, nodeCenterX, nodeCenterY);
                line.setAttribute('data-parent', parentId);
                line.classList.add('sub-connection');
                container.appendChild(line);
                
                // Create the node
                const nodeElement = createNode(child, 'sub-node', nodeX, nodeY, nodeWidth, nodeHeight);
                nodeElement.setAttribute('data-parent', parentId);
                
                if (child.children && child.children.length > 0) {
                    const indicator = document.createElement('span');
                    indicator.className = 'expand-indicator';
                    indicator.textContent = '▶';
                    nodeElement.appendChild(indicator);
                    
                    nodeElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleDetailNodes(child, nodeCenterX, nodeCenterY, angle, nodeElement);
                    });
                }
                
                container.appendChild(nodeElement);
                
                nodePositions.set(child.id, { 
                    x: nodeCenterX,
                    y: nodeCenterY,
                    width: nodeWidth,
                    height: nodeHeight,
                    element: nodeElement,
                    angle: angle
                });
                
                // Animate in
                setTimeout(() => {
                    nodeElement.classList.add('visible');
                    line.classList.add('visible');
                }, 50);
            });
        }
        
        function toggleDetailNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            const container = document.getElementById('mindMap');
            
            if (isExpanded) {
                // Collapse
                expandedNodes.delete(parentNode.id);
                
                parentNode.children.forEach(child => {
                    const detailElement = document.querySelector(\`[data-id="\${child.id}"]\`);
                    const connections = document.querySelectorAll(\`[data-parent="\${parentNode.id}"]\`);
                    
                    if (detailElement) {
                        detailElement.classList.remove('visible');
                        setTimeout(() => detailElement.remove(), 300);
                        nodePositions.delete(child.id);
                    }
                    
                    connections.forEach(conn => {
                        conn.classList.remove('visible');
                        setTimeout(() => conn.remove(), 300);
                    });
                });
                
                indicator.classList.remove('expanded');
                indicator.textContent = '▶';
            } else {
                // Expand
                expandedNodes.add(parentNode.id);
                layoutDetailNodes(parentNode.children, parentX, parentY, parentAngle, parentNode.id);
                indicator.classList.add('expanded');
                indicator.textContent = '▼';
            }
        }
        
        function layoutDetailNodes(children, parentX, parentY, parentAngle, parentId) {
            const container = document.getElementById('mindMap');
            const detailAngleSpread = Math.PI * 0.4; // 72 degrees
            const startAngle = parentAngle - detailAngleSpread / 2;
            
            children.forEach((child, index) => {
                const angle = children.length === 1 ? 
                    parentAngle : 
                    startAngle + (index * detailAngleSpread / (children.length - 1));
                
                const nodeSize = measureText(child.label, 11, 150);
                const nodeWidth = nodeSize.width;
                const nodeHeight = Math.max(nodeSize.height, 32);
                
                const nodeX = parentX + Math.cos(angle) * LAYOUT_CONFIG.DETAIL_RADIUS - nodeWidth/2;
                const nodeY = parentY + Math.sin(angle) * LAYOUT_CONFIG.DETAIL_RADIUS - nodeHeight/2;
                const nodeCenterX = nodeX + nodeWidth/2;
                const nodeCenterY = nodeY + nodeHeight/2;
                
                // Create connection line
                const line = createConnectionLine(parentX, parentY, nodeCenterX, nodeCenterY);
                line.setAttribute('data-parent', parentId);
                line.classList.add('detail-connection');
                container.appendChild(line);
                
                // Create the node
                const nodeElement = createNode(child, 'detail-node', nodeX, nodeY, nodeWidth, nodeHeight);
                nodeElement.setAttribute('data-parent', parentId);
                container.appendChild(nodeElement);
                
                nodePositions.set(child.id, { 
                    x: nodeCenterX,
                    y: nodeCenterY,
                    width: nodeWidth,
                    height: nodeHeight,
                    element: nodeElement
                });
                
                // Animate in
                setTimeout(() => {
                    nodeElement.classList.add('visible');
                    line.classList.add('visible');
                }, 50);
            });
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
        
        function createConnectionLine(x1, y1, x2, y2) {
            const line = document.createElement('div');
            line.className = 'connection-line';
            
            const deltaX = x2 - x1;
            const deltaY = y2 - y1;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            line.style.width = length + 'px';
            line.style.left = x1 + 'px';
            line.style.top = y1 + 'px';
            line.style.transform = \`rotate(\${angle}deg)\`;
            line.style.transformOrigin = '0 50%';
            
            return line;
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
        
        function applyTransform() {
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = \`scale(\${currentZoom}) translate(\${currentTransform.x}px, \${currentTransform.y}px)\`;
        }
        
        function expandAllNodes() {
            const mainNodes = document.querySelectorAll('.main-node .expand-indicator');
            mainNodes.forEach((indicator, index) => {
                if (!indicator.classList.contains('expanded')) {
                    setTimeout(() => {
                        indicator.parentElement.click();
                    }, index * 200);
                }
            });
        }
        
        function collapseAllNodes() {
            const expandedIndicators = document.querySelectorAll('.expand-indicator.expanded');
            expandedIndicators.forEach((indicator, index) => {
                setTimeout(() => {
                    indicator.parentElement.click();
                }, index * 100);
            });
        }
        
        // Control event listeners
        document.getElementById('zoomIn').addEventListener('click', () => {
            currentZoom = Math.min(currentZoom * 1.2, 3);
            applyTransform();
        });
        
        document.getElementById('zoomOut').addEventListener('click', () => {
            currentZoom = Math.max(currentZoom / 1.2, 0.3);
            applyTransform();
        });
        
        document.getElementById('resetView').addEventListener('click', () => {
            currentZoom = 1;
            currentTransform = { x: 0, y: 0 };
            applyTransform();
        });
        
        document.getElementById('expandAll').addEventListener('click', expandAllNodes);
        document.getElementById('collapseAll').addEventListener('click', collapseAllNodes);
        
        // Initialize the mind map
        createMindMap();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(createMindMap, 100);
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
      const mindMapUrl = '/api/teach/media/base-class-mind-map/' + asset.id;
      
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