import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MindMapRequest {
  lessonId: string;
  content?: string; // Optional fallback content
  gradeLevel: string;
}

interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main' | 'sub' | 'detail' | 'micro';
  children?: MindMapNode[];
  position?: { x: number; y: number };
  color?: string;
}

// Helper function to extract text from JSONB content (same as podcast API)
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
    const { lessonId, content: fallbackContent, gradeLevel }: MindMapRequest = await request.json();

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

    // Check if a mind map already exists for this lesson
    const { data: existingAssets } = await supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('asset_type', 'mind_map')
      .eq('status', 'completed');

    if (existingAssets && existingAssets.length > 0 && !regenerate) {
      return NextResponse.json(
        { error: 'A mind map already exists for this lesson' },
        { status: 409 }
      );
    }

    // If regenerating, delete existing mind maps first
    if (regenerate && existingAssets && existingAssets.length > 0) {
      const { error: deleteError } = await supabase
        .from('lesson_media_assets')
        .delete()
        .eq('lesson_id', lessonId)
        .eq('asset_type', 'mind_map');

      if (deleteError) {
        console.error('Failed to delete existing mind map:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete existing mind map' },
          { status: 500 }
        );
      }
    }

    // Fetch lesson details and all its sections
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('title, description')
      .eq('id', lessonId)
      .single();

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
    if (lesson.title) {
      comprehensiveContent += `Lesson Title: ${lesson.title}\n\n`;
    }
    if (lesson.description) {
      comprehensiveContent += `Lesson Description: ${lesson.description}\n\n`;
    }

    // Add all section content
    if (sections && sections.length > 0) {
      comprehensiveContent += 'Lesson Content:\n\n';
      
      sections.forEach((section, index) => {
        comprehensiveContent += `Section ${index + 1}: ${section.title}\n`;
        
        // Extract text content from JSONB
        const sectionText = extractTextFromContent(section.content);
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
        { error: 'No content available to generate mind map' },
        { status: 400 }
      );
    }

    // Generate mind map structure using OpenAI
    const prompt = `# Role and Objective
You are an expert educational designer and visual information architect creating premium, professional mind maps for grade ${gradeLevel} students. Your goal is to create clean, modern, and visually appealing educational content that clearly shows hierarchy and proper alignment.

# Content Context
${comprehensiveContent}

# Critical Design Requirements

## Visual Hierarchy & Structure (5-Level System)
1. **Root Node**: Single, clear main topic (2-4 words maximum)
2. **Main Branches**: 3-5 key concepts, each representing a major theme
3. **Sub-branches**: 2-4 supporting details per main branch
4. **Detail Level**: 1-3 specific concepts per sub-branch (detailed information)
5. **Micro-details**: 1-2 granular specifics per detail (when content is very rich)
6. **Label Quality**: Concise, descriptive labels (avoid long sentences)
7. **Logical Flow**: Organize content from general to specific

## Professional Styling Guidelines
- **Consistency**: All nodes at the same level should have similar length labels
- **Clarity**: Use simple, grade-appropriate terminology
- **Balance**: Distribute content evenly across branches
- **Hierarchy**: Clear visual distinction between levels
- **Alignment**: Ensure proper spacing and professional appearance

## Content Organization Rules (5-Level Hierarchy)
- **Root**: Main lesson topic (e.g., "Life in the Colonies")
- **Main Branches**: Core concepts (e.g., "Social Structure", "Economic Activities")
- **Sub-branches**: Specific details (e.g., "Colonial Classes", "Trade Routes")
- **Detail Level**: Focused concepts (e.g., "Upper Class", "Tobacco Trade")
- **Micro-details**: Granular specifics (e.g., "Merchants", "Artisans", "Export Regulations")
- **Language**: Student-friendly but academically appropriate for grade ${gradeLevel}

## Color Scheme Requirements
Use a professional, cohesive color palette:
- **Root**: Deep blue (#2563EB) - authority and focus
- **Main Branches**: Complementary colors from a curated palette
- **Sub-branches**: Lighter variations of parent colors
- **Ensure**: High contrast and accessibility

## Professional Color Palette
Main Branch Colors (use these exactly):
- "#10B981" (Emerald Green)
- "#8B5CF6" (Purple)
- "#F59E0B" (Amber)
- "#EF4444" (Red)
- "#06B6D4" (Cyan)

Sub-branch Colors (lighter variants):
- "#34D399" (Light Emerald)
- "#A78BFA" (Light Purple)
- "#FBBF24" (Light Amber)
- "#F87171" (Light Red)
- "#22D3EE" (Light Cyan)

Detail Colors (medium light variants):
- "#6EE7B7" (Medium Light Emerald)
- "#C4B5FD" (Medium Light Purple)
- "#FCD34D" (Medium Light Amber)
- "#FCA5A5" (Medium Light Red)
- "#67E8F9" (Medium Light Cyan)

Micro-detail Colors (very light variants):
- "#A7F3D0" (Very Light Emerald)
- "#DDD6FE" (Very Light Purple)
- "#FEF3C7" (Very Light Amber)
- "#FECACA" (Very Light Red)
- "#A5F3FC" (Very Light Cyan)

## JSON Structure Requirements
Return ONLY valid JSON in this exact format:

\`\`\`json
{
  "root": {
    "id": "root",
    "label": "Main Topic",
    "type": "root",
    "color": "#2563EB",
    "children": [
      {
        "id": "main1",
        "label": "Key Concept 1",
        "type": "main",
        "color": "#10B981",
        "children": [
          {
            "id": "sub1_1",
            "label": "Supporting Detail",
            "type": "sub",
            "color": "#34D399",
            "children": [
              {
                "id": "detail1_1_1",
                "label": "Specific Concept",
                "type": "detail",
                "color": "#6EE7B7",
                "children": [
                  {
                    "id": "micro1_1_1_1",
                    "label": "Granular Point",
                    "type": "micro",
                    "color": "#A7F3D0"
                  }
                ]
              }
            ]
          },
          {
            "id": "sub1_2",
            "label": "Another Detail",
            "type": "sub",
            "color": "#34D399"
          }
        ]
      },
      {
        "id": "main2",
        "label": "Key Concept 2",
        "type": "main",
        "color": "#8B5CF6",
        "children": [
          {
            "id": "sub2_1",
            "label": "Supporting Detail",
            "type": "sub",
            "color": "#A78BFA"
          }
        ]
      }
    ]
  },
  "title": "Professional Lesson Mind Map Title"
}
\`\`\`

# Quality Standards
- **Professional**: Clean, modern appearance suitable for educational presentations
- **Balanced**: Even distribution of content across branches
- **Consistent**: Uniform styling and spacing throughout
- **Clear**: Easy to read and understand at a glance
- **Educational**: Supports learning objectives for grade ${gradeLevel}

# Output Requirements
- Return ONLY valid JSON, no additional text or formatting
- Use the exact color codes provided above
- Ensure all node IDs are unique and descriptive
- Keep labels concise but informative (2-6 words per label)
- Maintain the exact JSON structure specified
- Focus on creating a premium, professional educational tool`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `# Role and Objective
You are a premium educational designer and visual information architect specializing in creating professional, modern mind maps for educational institutions. Your designs are used in high-quality educational presentations and must meet the highest standards of visual design and educational effectiveness.

# Core Design Principles
- **Professional Excellence**: Every element must look polished and premium
- **Visual Hierarchy**: Clear, consistent hierarchy that guides the eye naturally
- **Educational Impact**: Support learning through strategic visual organization
- **Modern Aesthetics**: Clean, contemporary design that appeals to students
- **Accessibility**: High contrast, readable fonts, logical structure

# Critical Requirements
- Return ONLY valid JSON, no additional text, markdown, or explanations
- Use EXACT color codes as specified in the prompt
- Create concise, impactful labels (2-6 words maximum)
- Ensure perfect balance and symmetry in content distribution
- Maintain consistent styling across all elements
- Focus on premium, professional appearance suitable for educational presentations
- NEVER include explanatory text or formatting - JSON ONLY`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const mindMapData = completion.choices[0]?.message?.content;
    if (!mindMapData) {
      throw new Error('Failed to generate mind map structure');
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
      
      console.log('Attempting to parse mind map JSON:', cleanedData.substring(0, 500));
      parsedMindMap = JSON.parse(cleanedData);
      
      // Validate the structure
      if (!parsedMindMap.root || !parsedMindMap.title) {
        throw new Error('Mind map missing required root or title');
      }
      
    } catch (e) {
      console.error('Failed to parse mind map JSON:', e);
      console.error('Raw response:', mindMapData);
      throw new Error('Invalid mind map structure generated');
    }

    // Generate interactive HTML mind map
    const htmlContent = generateInteractiveMindMap(parsedMindMap.root, parsedMindMap.title);

    // Save the mind map asset to the database
    const { data: assetData, error: assetError } = await supabase
      .from('lesson_media_assets')
      .insert({
        lesson_id: lessonId,
        asset_type: 'mind_map',
        title: parsedMindMap.title || 'Lesson Mind Map',
        content: {
          ...parsedMindMap,
          sections_count: sections?.length || 0,
          comprehensive_content_length: comprehensiveContent.length
        },
        svg_content: htmlContent,
        status: 'completed',
        created_by: user.id
      })
      .select()
      .single();

    if (assetError) {
      console.error('Database error:', assetError);
      throw new Error('Failed to save mind map');
    }

    // Generate a public URL for the mind map
    const mindMapUrl = `/api/teach/media/mind-map/${assetData.id}`;

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
    console.error('Mind map generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate mind map. Please try again.' },
      { status: 500 }
    );
  }
}

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
            /* Dynamic sizing - remove fixed dimensions */
            min-width: 80px;
            max-width: 280px;
            white-space: normal; /* Allow text wrapping */
            overflow: visible; /* Show all text */
        }
        
        .mind-map-node:hover {
            transform: scale(1.05) translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
            z-index: 100;
        }
        
        .root-node {
            background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%);
            font-size: 18px;
            font-weight: 700;
            z-index: 5;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
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
        
        .sub-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .detail-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Connection lines with semantic meaning */
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
        
        /* Semantic relationship indicators */
        .relationship-indicator {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 50;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .connection-line:hover + .relationship-indicator,
        .connection-line:hover .relationship-indicator {
            opacity: 1;
        }
        
        /* Knowledge graph clustering */
        .concept-cluster {
            position: absolute;
            border: 2px dashed rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(5px);
            z-index: 0;
            transition: all 0.3s ease;
        }
        
        .concept-cluster:hover {
            border-color: rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.05);
        }
        
        .cluster-label {
            position: absolute;
            top: -12px;
            left: 16px;
            background: rgba(0, 0, 0, 0.8);
            color: rgba(255, 255, 255, 0.8);
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: 500;
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
        
        /* Connection point indicators (for debugging) */
        .connection-point {
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            transform: translate(-2px, -2px);
            z-index: 10;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .debug-mode .connection-point {
            opacity: 1;
        }

        /* Enhanced controls */
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
        
        .help-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        
        .help-item:last-child {
            margin-bottom: 0;
        }
        
        .help-indicator {
            width: 12px;
            height: 3px;
            border-radius: 2px;
        }
        
        .help-indicator.primary { background: rgba(37, 99, 235, 0.8); }
        .help-indicator.secondary { background: rgba(16, 185, 129, 0.6); }
        .help-indicator.tertiary { background: rgba(139, 92, 246, 0.5); }
        .help-indicator.related { 
            background: repeating-linear-gradient(
                90deg,
                rgba(245, 158, 11, 0.6) 0px,
                rgba(245, 158, 11, 0.6) 3px,
                transparent 3px,
                transparent 6px
            );
        }
        
        /* Knowledge graph mode transformations */
        .knowledge-graph-mode .mind-map-node {
            border-radius: 8px;
            transform: scale(0.95);
            border-width: 1px;
        }
        
        .knowledge-graph-mode .root-node {
            border-radius: 12px;
            transform: scale(1.1);
        }
        
        .knowledge-graph-mode .connection-line {
            height: 1px;
            opacity: 0.6;
        }
        
        .knowledge-graph-mode .connection-line.primary {
            height: 2px;
            opacity: 0.8;
        }
        
        .knowledge-graph-mode .connection-line.secondary {
            height: 1px;
            opacity: 0.6;
        }
        
        .knowledge-graph-mode .connection-line.tertiary {
            height: 1px;
            opacity: 0.4;
        }
        
        /* Knowledge graph layout adjustments */
        .knowledge-graph-mode .mind-map-container {
            background: linear-gradient(135deg, #0a0f1c 0%, #1a1f2e 50%, #2a2f3e 100%);
        }
        
        /* Enhanced related connections */
        .related-connection {
            z-index: 2;
            animation: pulse-connection 2s infinite;
        }
        
        @keyframes pulse-connection {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        
        .related-connection.active {
            height: 3px !important;
            background: linear-gradient(90deg, rgba(245, 158, 11, 0.9) 0%, rgba(245, 158, 11, 0.4) 100%) !important;
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
        }
        
        /* Responsive design */
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
            
            .mind-map-node {
                font-size: 12px;
                padding: 8px 12px;
            }
            
            .root-node {
                font-size: 14px;
                min-width: 120px;
                min-height: 120px;
            }
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <h1 class="mind-map-title">${title}</h1>
        
        <!-- Enhanced Controls -->
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
            <div class="control-group">
                <button class="control-btn" id="toggleMode" title="Toggle Knowledge Graph Mode">🕸️</button>
                <button class="control-btn" id="showRelations" title="Show Related Concepts">🔗</button>
                <button class="control-btn" id="debugMode" title="Debug Connection Points">🔧</button>
            </div>
        </div>
        
        <!-- Enhanced Help Text -->
        <div class="help-text">
            <div class="help-item">
                <div class="help-indicator primary"></div>
                <span><strong>Primary:</strong> Core concepts</span>
            </div>
            <div class="help-item">
                <div class="help-indicator secondary"></div>
                <span><strong>Secondary:</strong> Supporting ideas</span>
            </div>
            <div class="help-item">
                <div class="help-indicator tertiary"></div>
                <span><strong>Detail:</strong> Specific information</span>
            </div>
            <div class="help-item">
                <div class="help-indicator related"></div>
                <span><strong>Related:</strong> Cross-connections</span>
            </div>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                Click nodes to expand • Drag to pan • Scroll to zoom
            </div>
        </div>
        
        <div id="mindMap"></div>
    </div>
    
    <script>
        const mindMapData = ${JSON.stringify(rootNode)};
        let currentZoom = 1;
        let expandedNodes = new Set();
        let nodePositions = new Map();
        let isKnowledgeGraphMode = false;
        let showRelatedConcepts = false;
        let relatedConnections = [];
        let debugMode = false;
        
        // Text measurement utility
        function measureText(text, fontSize, fontWeight = '600', maxWidth = 280) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = \`\${fontWeight} \${fontSize}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif\`;
            
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];
            
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = context.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth - 32) { // Account for padding
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            
            const textWidth = Math.max(...lines.map(line => context.measureText(line).width)) + 32;
            const textHeight = lines.length * fontSize * 1.3 + 24; // Line height + padding
            
            return {
                width: Math.min(Math.max(textWidth, 80), maxWidth),
                height: Math.max(textHeight, 32),
                lines: lines.length
            };
        }
        
        function createMindMap() {
            const container = document.getElementById('mindMap');
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            // Clear previous content
            container.innerHTML = '';
            nodePositions.clear();
            
            // Measure and create root node
            const rootMeasurement = measureText(mindMapData.label, 18, '700', 240);
            const rootWidth = Math.max(rootMeasurement.width, 160);
            const rootHeight = Math.max(rootMeasurement.height, 160);
            
            const rootNodeElement = createNode(mindMapData, 'root-node', centerX - rootWidth/2, centerY - rootHeight/2, rootWidth, rootHeight);
            container.appendChild(rootNodeElement);
            nodePositions.set(mindMapData.id, { 
                x: centerX, 
                y: centerY, 
                width: rootWidth, 
                height: rootHeight,
                element: rootNodeElement,
                type: 'root',
                color: mindMapData.color
            });
            
            // Create main branches with improved layout
            if (mindMapData.children) {
                const mainNodes = layoutMainNodes(mindMapData.children, centerX, centerY, rootWidth);
                
                mainNodes.forEach((nodeLayout, index) => {
                    const child = mindMapData.children[index];
                    const { x, y, angle } = nodeLayout;
                    
                    // Measure main node
                    const mainMeasurement = measureText(child.label, 14, '600', 220);
                    const mainWidth = mainMeasurement.width;
                    const mainHeight = Math.max(mainMeasurement.height, 40);
                    
                    // Create connection line with semantic meaning
                    const connectionType = getConnectionType(child, index);
                    const nodeConnectionX = x + mainWidth/2;
                    const nodeConnectionY = y + mainHeight/2;
                    const line = createConnectionLine(centerX, centerY, nodeConnectionX, nodeConnectionY, connectionType);
                    container.appendChild(line);
                    
                    // Create main node
                    const mainNode = createNode(child, 'main-node', x, y, mainWidth, mainHeight);
                    if (child.children && child.children.length > 0) {
                        const indicator = document.createElement('span');
                        indicator.className = 'expand-indicator';
                        indicator.textContent = '▶';
                        mainNode.appendChild(indicator);
                        
                        mainNode.addEventListener('click', () => toggleSubNodes(child, nodeConnectionX, nodeConnectionY, angle, mainNode));
                    }
                    container.appendChild(mainNode);
                    
                    // Store position
                    nodePositions.set(child.id, { 
                        x: nodeConnectionX, 
                        y: nodeConnectionY, 
                        width: mainWidth, 
                        height: mainHeight,
                        element: mainNode,
                        type: child.type,
                        color: child.color
                    });
                });
                
                // Create concept clusters
                if (mindMapData.children.length > 3) {
                    createConceptClusters(mindMapData.children, centerX, centerY);
                }
                
                // Generate related connections
                generateRelatedConnections();
            }
        }
        
        function getConnectionType(node, index) {
            // Assign semantic meaning to connections based on position and content
            if (index === 0) return 'primary';
            if (index < 3) return 'secondary';
            return 'tertiary';
        }
        
        function layoutMainNodes(children, centerX, centerY, rootWidth) {
            const nodes = [];
            const baseDistance = Math.max(400, rootWidth + 200);
            const minAngularSeparation = Math.PI / 3.5;
            
            if (children.length <= 4) {
                // Optimized circular layout
                const angleStep = Math.max(minAngularSeparation, (2 * Math.PI) / children.length);
                const startAngle = -Math.PI / 2;
                
                children.forEach((child, index) => {
                    const angle = startAngle + index * angleStep;
                    let distance = baseDistance;
                    
                    // Adjust distance based on text length
                    const textLength = child.label.length;
                    if (textLength > 25) distance += 80;
                    else if (textLength > 15) distance += 40;
                    
                    const measurement = measureText(child.label, 14, '600', 220);
                    const x = centerX + Math.cos(angle) * distance - measurement.width/2;
                    const y = centerY + Math.sin(angle) * distance - measurement.height/2;
                    
                    nodes.push({ x, y, angle });
                });
            } else if (children.length <= 8) {
                // Two-ring layout with better spacing
                const innerCount = Math.min(4, children.length);
                const outerCount = children.length - innerCount;
                
                // Inner ring
                const innerAngleStep = (2 * Math.PI) / innerCount;
                for (let i = 0; i < innerCount; i++) {
                    const angle = -Math.PI / 2 + i * innerAngleStep;
                    const measurement = measureText(children[i].label, 14, '600', 220);
                    const x = centerX + Math.cos(angle) * baseDistance - measurement.width/2;
                    const y = centerY + Math.sin(angle) * baseDistance - measurement.height/2;
                    nodes.push({ x, y, angle });
                }
                
                // Outer ring
                if (outerCount > 0) {
                    const outerAngleStep = (2 * Math.PI) / outerCount;
                    const outerDistance = baseDistance + 180;
                    const angleOffset = innerAngleStep / 2;
                    
                    for (let i = 0; i < outerCount; i++) {
                        const childIndex = innerCount + i;
                        const angle = -Math.PI / 2 + angleOffset + i * outerAngleStep;
                        const measurement = measureText(children[childIndex].label, 14, '600', 220);
                        const x = centerX + Math.cos(angle) * outerDistance - measurement.width/2;
                        const y = centerY + Math.sin(angle) * outerDistance - measurement.height/2;
                        nodes.push({ x, y, angle });
                    }
                }
            } else {
                // Grid layout for many nodes
                const cols = Math.ceil(Math.sqrt(children.length));
                const rows = Math.ceil(children.length / cols);
                const spacing = 250;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing;
                    
                    const measurement = measureText(child.label, 14, '600', 220);
                    const x = centerX + offsetX - measurement.width/2;
                    const y = centerY + offsetY + 250 - measurement.height/2;
                    
                    const angle = Math.atan2(y + measurement.height/2 - centerY, x + measurement.width/2 - centerX);
                    
                    nodes.push({ x, y, angle });
                });
            }
            
            return nodes;
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
            node.setAttribute('data-type', nodeData.type || 'main');
            
            // Apply semantic colors
            if (nodeData.color) {
                if (className === 'root-node') {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -20)} 100%)\`;
                } else {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -15)} 100%)\`;
                }
            }
            
            // Add connection point indicator for debugging
            const connectionPoint = document.createElement('div');
            connectionPoint.className = 'connection-point';
            connectionPoint.style.left = (x + width/2) + 'px';
            connectionPoint.style.top = (y + height/2) + 'px';
            document.getElementById('mindMap').appendChild(connectionPoint);
            
            return node;
        }
        
        function createConnectionLine(x1, y1, x2, y2, type = 'primary') {
            const line = document.createElement('div');
            line.className = \`connection-line \${type}\`;
            
            // Calculate the distance and angle
            const deltaX = x2 - x1;
            const deltaY = y2 - y1;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            // Adjust start and end points to account for node borders/padding
            const borderOffset = 8; // Offset to start/end just outside node borders
            const adjustedLength = Math.max(0, length - (borderOffset * 2));
            const offsetX = (deltaX / length) * borderOffset;
            const offsetY = (deltaY / length) * borderOffset;
            
            line.style.width = adjustedLength + 'px';
            line.style.left = (x1 + offsetX) + 'px';
            line.style.top = (y1 + offsetY) + 'px';
            line.style.transform = \`rotate(\${angle}deg)\`;
            
            return line;
        }
        
        function createConceptClusters(children, centerX, centerY) {
            // Group related concepts by color/type
            const clusters = {};
            children.forEach(child => {
                const key = child.color || child.type || 'default';
                if (!clusters[key]) clusters[key] = [];
                clusters[key].push(child);
            });
            
            Object.entries(clusters).forEach(([key, nodes]) => {
                if (nodes.length > 1) {
                    // Calculate cluster bounds
                    const positions = nodes.map(node => nodePositions.get(node.id)).filter(Boolean);
                    if (positions.length > 1) {
                        const minX = Math.min(...positions.map(p => p.x - p.width/2)) - 20;
                        const maxX = Math.max(...positions.map(p => p.x + p.width/2)) + 20;
                        const minY = Math.min(...positions.map(p => p.y - p.height/2)) - 20;
                        const maxY = Math.max(...positions.map(p => p.y + p.height/2)) + 20;
                        
                        const cluster = document.createElement('div');
                        cluster.className = 'concept-cluster';
                        cluster.style.left = minX + 'px';
                        cluster.style.top = minY + 'px';
                        cluster.style.width = (maxX - minX) + 'px';
                        cluster.style.height = (maxY - minY) + 'px';
                        
                        const label = document.createElement('div');
                        label.className = 'cluster-label';
                        label.textContent = \`\${nodes[0].type || 'Related'} Concepts\`;
                        cluster.appendChild(label);
                        
                        document.getElementById('mindMap').appendChild(cluster);
                    }
                }
            });
        }
        
        function generateRelatedConnections() {
            // Find semantic relationships between nodes
            const allNodes = Array.from(nodePositions.values());
            relatedConnections = [];
            
            // Get all node data for semantic analysis
            const nodeDataMap = new Map();
            
            function collectNodeData(node, parentPath = []) {
                nodeDataMap.set(node.id, {
                    ...node,
                    path: parentPath,
                    element: nodePositions.get(node.id)
                });
                
                if (node.children) {
                    node.children.forEach(child => {
                        collectNodeData(child, [...parentPath, node.id]);
                    });
                }
            }
            
            collectNodeData(mindMapData);
            
            // Find relationships based on multiple criteria
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const node1 = allNodes[i];
                    const node2 = allNodes[j];
                    
                    // Skip root node and direct parent-child relationships
                    if (node1.type === 'root' || node2.type === 'root') continue;
                    
                    const data1 = Array.from(nodeDataMap.values()).find(n => n.element === node1);
                    const data2 = Array.from(nodeDataMap.values()).find(n => n.element === node2);
                    
                    if (!data1 || !data2) continue;
                    
                    // Skip direct parent-child relationships
                    if (data1.path.includes(data2.id) || data2.path.includes(data1.id)) continue;
                    
                    let relationshipType = null;
                    let strength = 0;
                    
                    // 1. Same color (thematic relationship)
                    if (node1.color === node2.color && node1.color) {
                        relationshipType = 'thematic';
                        strength += 3;
                    }
                    
                    // 2. Similar text content (semantic relationship)
                    const text1 = data1.label?.toLowerCase() || '';
                    const text2 = data2.label?.toLowerCase() || '';
                    
                    // Check for common words (excluding common words)
                    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
                    const words1 = text1.split(' ').filter(w => w.length > 2 && !commonWords.includes(w));
                    const words2 = text2.split(' ').filter(w => w.length > 2 && !commonWords.includes(w));
                    
                    const commonWordCount = words1.filter(w => words2.includes(w)).length;
                    if (commonWordCount > 0) {
                        relationshipType = 'semantic';
                        strength += commonWordCount * 2;
                    }
                    
                    // 3. Same hierarchical level (peer relationship)
                    if (data1.path.length === data2.path.length && data1.path.length > 1) {
                        relationshipType = relationshipType || 'peer';
                        strength += 1;
                    }
                    
                    // 4. Cross-branch relationships (different main branches)
                    if (data1.path.length > 0 && data2.path.length > 0 && 
                        data1.path[0] !== data2.path[0]) {
                        relationshipType = relationshipType || 'cross-branch';
                        strength += 1;
                    }
                    
                    // Only add relationships with sufficient strength
                    if (strength >= 2 && relationshipType) {
                        relatedConnections.push({
                            from: node1,
                            to: node2,
                            type: 'related',
                            relationshipType: relationshipType,
                            strength: strength,
                            label: getRelationshipLabel(relationshipType, strength)
                        });
                    }
                }
            }
            
            // Sort by strength (strongest relationships first)
            relatedConnections.sort((a, b) => b.strength - a.strength);
            
            // Limit to top 8 relationships to avoid clutter
            relatedConnections = relatedConnections.slice(0, 8);
        }
        
        function getRelationshipLabel(type, strength) {
            const labels = {
                'thematic': ['Related Theme', 'Strong Theme', 'Core Theme'][Math.min(2, Math.floor(strength / 2))],
                'semantic': ['Similar Concept', 'Related Concept', 'Connected Idea'][Math.min(2, Math.floor(strength / 3))],
                'peer': ['Peer Level', 'Same Category', 'Parallel Concept'][Math.min(2, Math.floor(strength / 2))],
                'cross-branch': ['Cross Reference', 'Bridge Concept', 'Connecting Link'][Math.min(2, Math.floor(strength / 2))]
            };
            return labels[type] || 'Related';
        }
        
        function toggleDetailNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            
            if (isExpanded) {
                // Hide detail-nodes
                expandedNodes.delete(parentNode.id);
                parentNode.children.forEach(child => {
                    const detailNode = document.querySelector(\`[data-id="\${child.id}"]\`);
                    const detailLines = document.querySelectorAll(\`[data-parent="\${parentNode.id}"]\`);
                    if (detailNode) {
                        detailNode.classList.remove('visible');
                        setTimeout(() => detailNode.remove(), 300);
                        nodePositions.delete(child.id);
                    }
                    detailLines.forEach(line => {
                        line.classList.remove('visible');
                        setTimeout(() => line.remove(), 300);
                    });
                });
                indicator.classList.remove('expanded');
            } else {
                // Show detail-nodes
                expandedNodes.add(parentNode.id);
                const detailNodePositions = layoutDetailNodes(parentNode.children, parentX, parentY, parentAngle);
                
                parentNode.children.forEach((child, index) => {
                    const { x: detailX, y: detailY } = detailNodePositions[index];
                    
                    // Measure detail node
                    const detailMeasurement = measureText(child.label, 11, '600', 160);
                    const detailWidth = detailMeasurement.width;
                    const detailHeight = Math.max(detailMeasurement.height, 30);
                    
                    // Calculate detail node connection point
                    const detailConnectionX = detailX + detailWidth/2;
                    const detailConnectionY = detailY + detailHeight/2;
                    
                    // Create detail connection line
                    const detailLine = createConnectionLine(parentX, parentY, detailConnectionX, detailConnectionY, 'related');
                    detailLine.className += ' sub-connection-line';
                    detailLine.setAttribute('data-parent', parentNode.id);
                    document.getElementById('mindMap').appendChild(detailLine);
                    
                    // Create detail node
                    const detailNode = createNode(child, 'detail-node', detailX, detailY, detailWidth, detailHeight);
                    if (child.children && child.children.length > 0) {
                        const detailIndicator = document.createElement('span');
                        detailIndicator.className = 'expand-indicator';
                        detailIndicator.textContent = '▶';
                        detailNode.appendChild(detailIndicator);
                        
                        detailNode.addEventListener('click', () => toggleMicroNodes(child, detailConnectionX, detailConnectionY, parentAngle, detailNode));
                    }
                    document.getElementById('mindMap').appendChild(detailNode);
                    
                    // Store position
                    nodePositions.set(child.id, {
                        x: detailConnectionX,
                        y: detailConnectionY,
                        width: detailWidth,
                        height: detailHeight,
                        element: detailNode,
                        type: child.type,
                        color: child.color
                    });
                    
                    // Animate in
                    setTimeout(() => {
                        detailNode.classList.add('visible');
                        detailLine.classList.add('visible');
                    }, 50);
                });
                indicator.classList.add('expanded');
            }
        }
        
        function toggleMicroNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            
            if (isExpanded) {
                // Hide micro-nodes
                expandedNodes.delete(parentNode.id);
                parentNode.children.forEach(child => {
                    const microNode = document.querySelector(\`[data-id="\${child.id}"]\`);
                    const microLines = document.querySelectorAll(\`[data-parent="\${parentNode.id}"]\`);
                    if (microNode) {
                        microNode.classList.remove('visible');
                        setTimeout(() => microNode.remove(), 300);
                        nodePositions.delete(child.id);
                    }
                    microLines.forEach(line => {
                        line.classList.remove('visible');
                        setTimeout(() => line.remove(), 300);
                    });
                });
                indicator.classList.remove('expanded');
            } else {
                // Show micro-nodes
                expandedNodes.add(parentNode.id);
                const microNodePositions = layoutMicroNodes(parentNode.children, parentX, parentY, parentAngle);
                
                parentNode.children.forEach((child, index) => {
                    const { x: microX, y: microY } = microNodePositions[index];
                    
                    // Measure micro node
                    const microMeasurement = measureText(child.label, 10, '600', 120);
                    const microWidth = microMeasurement.width;
                    const microHeight = Math.max(microMeasurement.height, 26);
                    
                    // Calculate micro node connection point
                    const microConnectionX = microX + microWidth/2;
                    const microConnectionY = microY + microHeight/2;
                    
                    // Create micro connection line
                    const microLine = createConnectionLine(parentX, parentY, microConnectionX, microConnectionY, 'related');
                    microLine.className += ' sub-connection-line';
                    microLine.setAttribute('data-parent', parentNode.id);
                    document.getElementById('mindMap').appendChild(microLine);
                    
                    // Create micro node
                    const microNode = createNode(child, 'micro-node', microX, microY, microWidth, microHeight);
                    document.getElementById('mindMap').appendChild(microNode);
                    
                    // Store position
                    nodePositions.set(child.id, {
                        x: microConnectionX,
                        y: microConnectionY,
                        width: microWidth,
                        height: microHeight,
                        element: microNode,
                        type: child.type,
                        color: child.color
                    });
                    
                    // Animate in
                    setTimeout(() => {
                        microNode.classList.add('visible');
                        microLine.classList.add('visible');
                    }, 50);
                });
                indicator.classList.add('expanded');
            }
        }
        
        function layoutDetailNodes(children, parentX, parentY, parentAngle) {
            const positions = [];
            const detailDistance = 160;
            const minDetailAngle = Math.PI / 5;
            const maxSpread = Math.PI * 0.7;
            
            if (children.length === 1) {
                const measurement = measureText(children[0].label, 11, '600', 160);
                const x = parentX + Math.cos(parentAngle) * detailDistance - measurement.width/2;
                const y = parentY + Math.sin(parentAngle) * detailDistance - measurement.height/2;
                positions.push({ x, y });
            } else if (children.length <= 3) {
                const angleSpread = Math.min(maxSpread, (children.length - 1) * minDetailAngle);
                const startAngle = parentAngle - angleSpread / 2;
                
                children.forEach((child, index) => {
                    const angle = children.length === 1 ? 
                        startAngle : 
                        startAngle + (index * angleSpread / (children.length - 1));
                    const measurement = measureText(child.label, 11, '600', 160);
                    const x = parentX + Math.cos(angle) * detailDistance - measurement.width/2;
                    const y = parentY + Math.sin(angle) * detailDistance - measurement.height/2;
                    positions.push({ x, y });
                });
            } else {
                // Grid layout for many detail-nodes
                const cols = Math.min(2, children.length);
                const rows = Math.ceil(children.length / cols);
                const spacing = 100;
                
                const gridCenterX = parentX + Math.cos(parentAngle) * detailDistance;
                const gridCenterY = parentY + Math.sin(parentAngle) * detailDistance;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing * 0.7;
                    
                    const measurement = measureText(child.label, 11, '600', 160);
                    const x = gridCenterX + offsetX - measurement.width/2;
                    const y = gridCenterY + offsetY - measurement.height/2;
                    positions.push({ x, y });
                });
            }
            
            return positions;
        }
        
        function layoutMicroNodes(children, parentX, parentY, parentAngle) {
            const positions = [];
            const microDistance = 100;
            const minMicroAngle = Math.PI / 6;
            const maxSpread = Math.PI * 0.5;
            
            if (children.length === 1) {
                const measurement = measureText(children[0].label, 10, '600', 120);
                const x = parentX + Math.cos(parentAngle) * microDistance - measurement.width/2;
                const y = parentY + Math.sin(parentAngle) * microDistance - measurement.height/2;
                positions.push({ x, y });
            } else if (children.length <= 2) {
                const angleSpread = Math.min(maxSpread, (children.length - 1) * minMicroAngle);
                const startAngle = parentAngle - angleSpread / 2;
                
                children.forEach((child, index) => {
                    const angle = children.length === 1 ? 
                        startAngle : 
                        startAngle + (index * angleSpread / (children.length - 1));
                    const measurement = measureText(child.label, 10, '600', 120);
                    const x = parentX + Math.cos(angle) * microDistance - measurement.width/2;
                    const y = parentY + Math.sin(angle) * microDistance - measurement.height/2;
                    positions.push({ x, y });
                });
            } else {
                // Compact grid layout for many micro-nodes
                const cols = Math.min(2, children.length);
                const rows = Math.ceil(children.length / cols);
                const spacing = 70;
                
                const gridCenterX = parentX + Math.cos(parentAngle) * microDistance;
                const gridCenterY = parentY + Math.sin(parentAngle) * microDistance;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing * 0.5;
                    
                    const measurement = measureText(child.label, 10, '600', 120);
                    const x = gridCenterX + offsetX - measurement.width/2;
                    const y = gridCenterY + offsetY - measurement.height/2;
                    positions.push({ x, y });
                });
            }
            
            return positions;
        }
        
        function toggleSubNodes(parentNode, parentX, parentY, parentAngle, domNode) {
            const indicator = domNode.querySelector('.expand-indicator');
            const isExpanded = indicator.classList.contains('expanded');
            
            if (isExpanded) {
                // Hide sub-nodes
                expandedNodes.delete(parentNode.id);
                parentNode.children.forEach(child => {
                    const subNode = document.querySelector(\`[data-id="\${child.id}"]\`);
                    const subLines = document.querySelectorAll(\`[data-parent="\${parentNode.id}"]\`);
                    if (subNode) {
                        subNode.classList.remove('visible');
                        setTimeout(() => subNode.remove(), 300);
                        nodePositions.delete(child.id);
                    }
                    subLines.forEach(line => {
                        line.classList.remove('visible');
                        setTimeout(() => line.remove(), 300);
                    });
                });
                indicator.classList.remove('expanded');
            } else {
                // Show sub-nodes
                expandedNodes.add(parentNode.id);
                const subNodePositions = layoutSubNodes(parentNode.children, parentX, parentY, parentAngle);
                
                parentNode.children.forEach((child, index) => {
                    const { x: subX, y: subY } = subNodePositions[index];
                    
                    // Measure sub node
                    const subMeasurement = measureText(child.label, 12, '600', 180);
                    const subWidth = subMeasurement.width;
                    const subHeight = Math.max(subMeasurement.height, 32);
                    
                    // Calculate sub node connection point
                    const subConnectionX = subX + subWidth/2;
                    const subConnectionY = subY + subHeight/2;
                    
                    // Create sub connection line
                    const subLine = createConnectionLine(parentX, parentY, subConnectionX, subConnectionY, 'tertiary');
                    subLine.className += ' sub-connection-line';
                    subLine.setAttribute('data-parent', parentNode.id);
                    document.getElementById('mindMap').appendChild(subLine);
                    
                    // Create sub node
                    const subNode = createNode(child, 'sub-node', subX, subY, subWidth, subHeight);
                    if (child.children && child.children.length > 0) {
                        const subIndicator = document.createElement('span');
                        subIndicator.className = 'expand-indicator';
                        subIndicator.textContent = '▶';
                        subNode.appendChild(subIndicator);
                        
                        subNode.addEventListener('click', () => toggleDetailNodes(child, subConnectionX, subConnectionY, parentAngle, subNode));
                    }
                    document.getElementById('mindMap').appendChild(subNode);
                    
                    // Store position
                    nodePositions.set(child.id, {
                        x: subConnectionX,
                        y: subConnectionY,
                        width: subWidth,
                        height: subHeight,
                        element: subNode,
                        type: child.type,
                        color: child.color
                    });
                    
                    // Animate in
                    setTimeout(() => {
                        subNode.classList.add('visible');
                        subLine.classList.add('visible');
                    }, 50);
                });
                indicator.classList.add('expanded');
            }
        }
        
        function layoutSubNodes(children, parentX, parentY, parentAngle) {
            const positions = [];
            const subDistance = 200;
            const minSubAngle = Math.PI / 4.5;
            const maxSpread = Math.PI * 0.8;
            
            if (children.length === 1) {
                const measurement = measureText(children[0].label, 12, '600', 180);
                const x = parentX + Math.cos(parentAngle) * subDistance - measurement.width/2;
                const y = parentY + Math.sin(parentAngle) * subDistance - measurement.height/2;
                positions.push({ x, y });
            } else if (children.length <= 4) {
                const angleSpread = Math.min(maxSpread, (children.length - 1) * minSubAngle);
                const startAngle = parentAngle - angleSpread / 2;
                
                children.forEach((child, index) => {
                    const angle = children.length === 1 ? 
                        startAngle : 
                        startAngle + (index * angleSpread / (children.length - 1));
                    const measurement = measureText(child.label, 12, '600', 180);
                    const x = parentX + Math.cos(angle) * subDistance - measurement.width/2;
                    const y = parentY + Math.sin(angle) * subDistance - measurement.height/2;
                    positions.push({ x, y });
                });
            } else {
                // Grid layout for many sub-nodes
                const cols = Math.min(3, children.length);
                const rows = Math.ceil(children.length / cols);
                const spacing = 120;
                
                const gridCenterX = parentX + Math.cos(parentAngle) * subDistance;
                const gridCenterY = parentY + Math.sin(parentAngle) * subDistance;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing * 0.7;
                    
                    const measurement = measureText(child.label, 12, '600', 180);
                    const x = gridCenterX + offsetX - measurement.width/2;
                    const y = gridCenterY + offsetY - measurement.height/2;
                    positions.push({ x, y });
                });
            }
            
            return positions;
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
        
        // Enhanced control functions
        function toggleKnowledgeGraphMode() {
            isKnowledgeGraphMode = !isKnowledgeGraphMode;
            const container = document.getElementById('mindMap');
            const toggleBtn = document.getElementById('toggleMode');
            
            if (isKnowledgeGraphMode) {
                container.classList.add('knowledge-graph-mode');
                toggleBtn.classList.add('active');
                
                // Apply knowledge graph transformations
                applyKnowledgeGraphLayout();
                
                // Show mode notification
                showModeNotification('Knowledge Graph Mode', 'Analytical view with enhanced relationships');
                
            } else {
                container.classList.remove('knowledge-graph-mode');
                toggleBtn.classList.remove('active');
                
                // Revert to mind map layout
                revertToMindMapLayout();
                
                // Show mode notification
                showModeNotification('Mind Map Mode', 'Hierarchical view with traditional layout');
            }
        }
        
        function applyKnowledgeGraphLayout() {
            // Adjust node spacing for more analytical look
            const allNodes = document.querySelectorAll('.mind-map-node');
            allNodes.forEach((node, index) => {
                // Add subtle animation delay
                node.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                node.style.transitionDelay = (index * 50) + 'ms';
                
                // Add data-driven styling
                const nodeType = node.getAttribute('data-type');
                if (nodeType === 'main') {
                    node.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    node.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                }
            });
            
            // Enhance connection lines
            const allLines = document.querySelectorAll('.connection-line');
            allLines.forEach(line => {
                line.style.transition = 'all 0.4s ease';
            });
            
            // Auto-show related connections in knowledge graph mode
            if (!showRelatedConcepts && relatedConnections.length > 0) {
                setTimeout(() => {
                    document.getElementById('showRelations').click();
                }, 800);
            }
        }
        
        function revertToMindMapLayout() {
            // Remove knowledge graph specific styling
            const allNodes = document.querySelectorAll('.mind-map-node');
            allNodes.forEach(node => {
                node.style.borderColor = '';
                node.style.boxShadow = '';
                node.style.transitionDelay = '';
            });
            
            // Hide related connections when reverting to mind map
            if (showRelatedConcepts) {
                setTimeout(() => {
                    document.getElementById('showRelations').click();
                }, 200);
            }
        }
        
        function showModeNotification(title, description) {
            const notification = document.createElement('div');
            notification.innerHTML = \`
                <div style="font-weight: 600; margin-bottom: 4px;">\${title}</div>
                <div style="font-size: 11px; opacity: 0.8;">\${description}</div>
            \`;
            notification.style.position = 'absolute';
            notification.style.top = '80px';
            notification.style.right = '20px';
            notification.style.background = 'rgba(37, 99, 235, 0.9)';
            notification.style.color = 'white';
            notification.style.padding = '12px 16px';
            notification.style.borderRadius = '12px';
            notification.style.fontSize = '12px';
            notification.style.zIndex = '100';
            notification.style.opacity = '0';
            notification.style.transition = 'all 0.3s ease';
            notification.style.transform = 'translateX(20px)';
            notification.style.backdropFilter = 'blur(10px)';
            notification.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            notification.style.maxWidth = '200px';
            
            document.getElementById('mindMap').appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(20px)';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
        
        function toggleRelatedConnections() {
            showRelatedConcepts = !showRelatedConcepts;
            const container = document.getElementById('mindMap');
            const showBtn = document.getElementById('showRelations');
            
            if (showRelatedConcepts) {
                // Show related connections with enhanced visuals
                relatedConnections.forEach((connection, index) => {
                    // Create the connection line
                    const line = createConnectionLine(
                        connection.from.x, connection.from.y,
                        connection.to.x, connection.to.y,
                        'related'
                    );
                    line.classList.add('related-connection');
                    
                    // Add strength-based styling
                    if (connection.strength >= 5) {
                        line.classList.add('active');
                    }
                    
                    // Add relationship type as data attribute
                    line.setAttribute('data-relationship', connection.relationshipType);
                    line.setAttribute('data-strength', connection.strength);
                    
                    // Animate in with delay
                    line.style.opacity = '0';
                    container.appendChild(line);
                    
                    setTimeout(() => {
                        line.style.opacity = '';
                        line.style.transition = 'opacity 0.5s ease';
                    }, index * 200);
                    
                    // Create relationship label
                    const midX = (connection.from.x + connection.to.x) / 2;
                    const midY = (connection.from.y + connection.to.y) / 2;
                    
                    const label = document.createElement('div');
                    label.className = 'relationship-label';
                    label.textContent = connection.label;
                    label.style.position = 'absolute';
                    label.style.left = midX + 'px';
                    label.style.top = midY + 'px';
                    label.style.transform = 'translate(-50%, -50%)';
                    label.style.background = 'rgba(0, 0, 0, 0.8)';
                    label.style.color = 'rgba(245, 158, 11, 0.9)';
                    label.style.padding = '2px 6px';
                    label.style.borderRadius = '8px';
                    label.style.fontSize = '10px';
                    label.style.fontWeight = '500';
                    label.style.opacity = '0';
                    label.style.transition = 'opacity 0.3s ease';
                    label.style.pointerEvents = 'none';
                    label.style.zIndex = '20';
                    label.style.backdropFilter = 'blur(5px)';
                    label.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                    label.classList.add('related-connection');
                    
                    container.appendChild(label);
                    
                    // Show label on hover
                    line.addEventListener('mouseenter', () => {
                        label.style.opacity = '1';
                    });
                    
                    line.addEventListener('mouseleave', () => {
                        label.style.opacity = '0';
                    });
                });
                
                showBtn.classList.add('active');
                
                // Show notification
                showRelationshipNotification(relatedConnections.length);
                
            } else {
                // Hide related connections
                document.querySelectorAll('.related-connection').forEach(line => line.remove());
                showBtn.classList.remove('active');
            }
        }
        
        function showRelationshipNotification(count) {
            const notification = document.createElement('div');
            notification.textContent = \`Found \${count} related connections\`;
            notification.style.position = 'absolute';
            notification.style.top = '80px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.background = 'rgba(245, 158, 11, 0.9)';
            notification.style.color = 'white';
            notification.style.padding = '8px 16px';
            notification.style.borderRadius = '20px';
            notification.style.fontSize = '12px';
            notification.style.fontWeight = '600';
            notification.style.zIndex = '100';
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            
            document.getElementById('mindMap').appendChild(notification);
            
            setTimeout(() => notification.style.opacity = '1', 100);
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }
        
        function expandAllNodes() {
            const mainNodes = document.querySelectorAll('.main-node');
            mainNodes.forEach((nodeElement, index) => {
                const indicator = nodeElement.querySelector('.expand-indicator');
                if (indicator && !indicator.classList.contains('expanded')) {
                    setTimeout(() => {
                        nodeElement.click();
                    }, index * 150);
                }
            });
        }
        
        function collapseAllNodes() {
            const mainNodes = document.querySelectorAll('.main-node');
            mainNodes.forEach((nodeElement, index) => {
                const indicator = nodeElement.querySelector('.expand-indicator');
                if (indicator && indicator.classList.contains('expanded')) {
                    setTimeout(() => {
                        nodeElement.click();
                    }, index * 100);
                }
            });
        }
        
        function toggleDebugMode() {
            debugMode = !debugMode;
            const container = document.getElementById('mindMap');
            const debugBtn = document.getElementById('debugMode');
            
            if (debugMode) {
                container.classList.add('debug-mode');
                debugBtn.classList.add('active');
            } else {
                container.classList.remove('debug-mode');
                debugBtn.classList.remove('active');
            }
        }
        
        // Control event listeners
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
            initialTransform = { x: 0, y: 0 };
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = 'scale(1) translate(0, 0)';
        });
        
        document.getElementById('expandAll').addEventListener('click', expandAllNodes);
        document.getElementById('collapseAll').addEventListener('click', collapseAllNodes);
        document.getElementById('toggleMode').addEventListener('click', toggleKnowledgeGraphMode);
        document.getElementById('showRelations').addEventListener('click', toggleRelatedConnections);
        document.getElementById('debugMode').addEventListener('click', toggleDebugMode);
        
        function applyZoom() {
            const mindMap = document.getElementById('mindMap');
            const currentTransform = mindMap.style.transform;
            const translateMatch = currentTransform.match(/translate\\((.+?)px,\\s*(.+?)px\\)/);
            let translateX = initialTransform.x;
            let translateY = initialTransform.y;
            
            if (translateMatch) {
                translateX = parseFloat(translateMatch[1]);
                translateY = parseFloat(translateMatch[2]);
            }
            
            mindMap.style.transform = \`scale(\${currentZoom}) translate(\${translateX}px, \${translateY}px)\`;
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
        
        // Drag to pan
        let isDragging = false;
        let startX, startY, initialTransform = { x: 0, y: 0 };
        
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.mind-map-node') || e.target.closest('.control-btn')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            document.body.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const deltaX = (e.clientX - startX) / currentZoom;
            const deltaY = (e.clientY - startY) / currentZoom;
            
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = \`scale(\${currentZoom}) translate(\${initialTransform.x + deltaX}px, \${initialTransform.y + deltaY}px)\`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                const mindMap = document.getElementById('mindMap');
                const transform = mindMap.style.transform;
                const translateMatch = transform.match(/translate\\((.+?)px,\\s*(.+?)px\\)/);
                if (translateMatch) {
                    initialTransform.x = parseFloat(translateMatch[1]);
                    initialTransform.y = parseFloat(translateMatch[2]);
                }
            }
            isDragging = false;
            document.body.style.cursor = 'default';
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                currentZoom = 1;
                initialTransform = { x: 0, y: 0 };
                const mindMap = document.getElementById('mindMap');
                mindMap.style.transform = 'scale(1) translate(0, 0)';
            } else if (e.key === '=' || e.key === '+') {
                currentZoom = Math.min(currentZoom * 1.2, 3);
                applyZoom();
            } else if (e.key === '-') {
                currentZoom = Math.max(currentZoom / 1.2, 0.3);
                applyZoom();
            } else if (e.key === 'g' || e.key === 'G') {
                toggleKnowledgeGraphMode();
            } else if (e.key === 'r' || e.key === 'R') {
                toggleRelatedConnections();
            } else if (e.key === 'd' || e.key === 'D') {
                toggleDebugMode();
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