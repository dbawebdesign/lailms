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
    const prompt = `Create a detailed mind map for this lesson. Return ONLY valid JSON.

CONTENT:
${comprehensiveContent}

REQUIREMENTS:
- Grade level: ${gradeLevel}
- 4-level hierarchy: Root → Main concepts → Sub-concepts → Details
- Educational focus with clear learning progression
- Balanced content distribution

STRUCTURE:
Root: Lesson topic (2-4 words)
Main branches: Key concepts (3-5 major themes)
Sub-branches: Supporting details (2-4 per main branch)
Details: Specific concepts (1-3 per sub-branch)

COLORS (use exactly):
Root: "#2563EB"
Main: ["#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"]
Sub: ["#34D399", "#A78BFA", "#FBBF24", "#F87171", "#22D3EE"]
Detail: ["#6EE7B7", "#C4B5FD", "#FCD34D", "#FCA5A5", "#67E8F9"]

JSON FORMAT:
{
  "root": {
    "id": "root",
    "label": "Lesson Topic",
    "type": "root",
    "color": "#2563EB",
    "children": [
      {
        "id": "main1",
        "label": "Key Concept",
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
                "label": "Specific Point",
                "type": "detail",
                "color": "#6EE7B7"
              }
            ]
          }
        ]
      }
    ]
  },
  "title": "Lesson Mind Map"
}

CONSTRAINTS:
- Maximum 4 levels deep
- Labels: 2-6 words each
- Cover all major lesson content
- Use exact color codes provided
- Return only JSON, no explanations`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are an educational mind map designer. Create clear, hierarchical visualizations that help students understand complex topics.

CORE PRINCIPLES:
- Educational focus supporting learning comprehension
- Clear hierarchy from general to specific concepts
- Visual balance across content areas
- Grade-appropriate language and terminology

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON, no explanations
- Use EXACT color codes from prompt
- Ensure proper JSON structure with all brackets closed
- Maximum 4 levels deep to avoid complexity
- Cover all major aspects of the topic
- Keep labels concise (2-6 words)`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 12000, // Increased significantly to prevent truncation
      temperature: 0.3, // Reduced for more consistent output
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
      
      console.log('Attempting to parse mind map JSON:', cleanedData.substring(0, 500));
      console.log('JSON ends with:', cleanedData.slice(-100));
      
      parsedMindMap = JSON.parse(cleanedData);
      
      // Validate the structure
      if (!parsedMindMap.root || !parsedMindMap.title) {
        throw new Error('Mind map missing required root or title');
      }
      
    } catch (e: unknown) {
      console.error('Failed to parse mind map JSON:', e);
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
          label: lesson.title || "Lesson",
          type: "root",
          color: "#2563EB",
          children: sections?.slice(0, 5).map((section: any, index: number) => ({
            id: `main${index + 1}`,
            label: section.title.substring(0, 20),
            type: "main",
            color: ["#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"][index % 5],
            children: []
          })) || []
        },
        title: `${lesson.title} Mind Map`
      };
      
      console.log('Using fallback structure with', parsedMindMap.root.children.length, 'sections');
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
            background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%);
            font-size: 18px;
            font-weight: 700;
            z-index: 5;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
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
            <div style="font-weight: 600; margin-bottom: 8px;">Lesson Overview</div>
            <div style="font-size: 11px; opacity: 0.8;">
                <strong>Navigate:</strong> Click to expand • Drag to pan • Scroll to zoom<br>
                <strong>Structure:</strong> Topic → Concepts → Details
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
            context.font = \`\${fontSize}px Inter, sans-serif\`;
            
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];
            
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = context.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            
            const maxLineWidth = Math.max(...lines.map(line => context.measureText(line).width));
            return {
                width: Math.min(maxLineWidth + 32, maxWidth + 32),
                height: lines.length * (fontSize * 1.4) + 24,
                lines: lines.length
            };
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
            
            // Apply colors if available
            if (nodeData.color) {
                if (className === 'root-node') {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -20)} 100%)\`;
                } else {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -15)} 100%)\`;
                }
            }
            
            // Add expand indicator for nodes with children
            if (nodeData.children && nodeData.children.length > 0) {
                const indicator = document.createElement('span');
                indicator.className = 'expand-indicator';
                indicator.textContent = '▶';
                node.appendChild(indicator);
            }
            
            // Add click handler
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                if (nodeData.children && nodeData.children.length > 0) {
                    toggleSubNodes(nodeData.id);
                }
            });
            
            return node;
        }
        
        function adjustBrightness(color, percent) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
        }
        
        function createConnection(x1, y1, x2, y2, className = 'connection-line') {
            const line = document.createElement('div');
            line.className = className;
            
            const deltaX = x2 - x1;
            const deltaY = y2 - y1;
            const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            line.style.left = x1 + 'px';
            line.style.top = y1 + 'px';
            line.style.width = length + 'px';
            line.style.transform = \`rotate(\${angle}deg)\`;
            
            return line;
        }
        
        function layoutNodes() {
            const container = document.getElementById('mindMap');
            const centerX = container.offsetWidth / 2;
            const centerY = container.offsetHeight / 2;
            
            // Clear existing content
            container.innerHTML = '';
            nodePositions.clear();
            
            // Create root node
            const rootMeasure = measureText(mindMapData.label, 18, 240);
            const rootNode = createNode(mindMapData, 'root-node', 
                centerX - rootMeasure.width / 2, 
                centerY - rootMeasure.height / 2, 
                rootMeasure.width, 
                rootMeasure.height
            );
            container.appendChild(rootNode);
            
            nodePositions.set(mindMapData.id, {
                x: centerX,
                y: centerY,
                width: rootMeasure.width,
                height: rootMeasure.height,
                node: rootNode,
                data: mindMapData
            });
            
            // Layout main branches
            if (mindMapData.children) {
                layoutMainBranches(mindMapData.children, centerX, centerY, container);
            }
        }
        
        function layoutMainBranches(children, centerX, centerY, container) {
            const angleStep = LAYOUT_CONFIG.ANGLE_SPREAD / Math.max(1, children.length - 1);
            const startAngle = -LAYOUT_CONFIG.ANGLE_SPREAD / 2;
            
            children.forEach((child, index) => {
                const angle = startAngle + (index * angleStep);
                const x = centerX + Math.cos(angle) * LAYOUT_CONFIG.MAIN_RADIUS;
                const y = centerY + Math.sin(angle) * LAYOUT_CONFIG.MAIN_RADIUS;
                
                const measure = measureText(child.label, 14, 220);
                const node = createNode(child, 'main-node', 
                    x - measure.width / 2, 
                    y - measure.height / 2, 
                    measure.width, 
                    measure.height
                );
                container.appendChild(node);
                
                nodePositions.set(child.id, {
                    x: x,
                    y: y,
                    width: measure.width,
                    height: measure.height,
                    node: node,
                    data: child,
                    parentId: mindMapData.id
                });
                
                // Create connection to root
                const connection = createConnection(centerX, centerY, x, y);
                container.appendChild(connection);
            });
        }
        
        function toggleSubNodes(nodeId) {
            const nodePos = nodePositions.get(nodeId);
            if (!nodePos || !nodePos.data.children) return;
            
            const isExpanded = expandedNodes.has(nodeId);
            const container = document.getElementById('mindMap');
            
            if (isExpanded) {
                // Collapse: remove sub-nodes and connections
                expandedNodes.delete(nodeId);
                
                // Remove sub-nodes and their connections
                nodePos.data.children.forEach(child => {
                    const childPos = nodePositions.get(child.id);
                    if (childPos) {
                        childPos.node.remove();
                        nodePositions.delete(child.id);
                        
                        // Remove connections
                        container.querySelectorAll(\`[data-parent="\${child.id}"]\`).forEach(conn => conn.remove());
                        
                        // Recursively collapse children
                        if (expandedNodes.has(child.id)) {
                            toggleSubNodes(child.id);
                        }
                    }
                });
                
                // Remove connections from parent to children
                container.querySelectorAll(\`[data-parent="\${nodeId}"]\`).forEach(conn => conn.remove());
                
                // Update expand indicator
                const indicator = nodePos.node.querySelector('.expand-indicator');
                if (indicator) {
                    indicator.textContent = '▶';
                    indicator.classList.remove('expanded');
                }
            } else {
                // Expand: add sub-nodes
                expandedNodes.add(nodeId);
                layoutSubNodes(nodePos, container);
                
                // Update expand indicator
                const indicator = nodePos.node.querySelector('.expand-indicator');
                if (indicator) {
                    indicator.textContent = '▼';
                    indicator.classList.add('expanded');
                }
            }
        }
        
        function layoutSubNodes(parentPos, container) {
            const children = parentPos.data.children;
            if (!children || children.length === 0) return;
            
            const angleStep = Math.PI * 1.2 / Math.max(1, children.length - 1);
            const startAngle = -Math.PI * 0.6;
            
            children.forEach((child, index) => {
                const angle = startAngle + (index * angleStep);
                const distance = parentPos.data.type === 'main' ? LAYOUT_CONFIG.SUB_RADIUS : LAYOUT_CONFIG.DETAIL_RADIUS;
                const x = parentPos.x + Math.cos(angle) * distance;
                const y = parentPos.y + Math.sin(angle) * distance;
                
                const className = parentPos.data.type === 'main' ? 'sub-node' : 'detail-node';
                const fontSize = parentPos.data.type === 'main' ? 12 : 11;
                const maxWidth = parentPos.data.type === 'main' ? 180 : 140;
                
                const measure = measureText(child.label, fontSize, maxWidth);
                const node = createNode(child, className, 
                    x - measure.width / 2, 
                    y - measure.height / 2, 
                    measure.width, 
                    measure.height
                );
                
                container.appendChild(node);
                
                nodePositions.set(child.id, {
                    x: x,
                    y: y,
                    width: measure.width,
                    height: measure.height,
                    node: node,
                    data: child,
                    parentId: parentPos.data.id
                });
                
                // Create connection to parent
                const connectionClass = parentPos.data.type === 'main' ? 'sub-connection' : 'detail-connection';
                const connection = createConnection(parentPos.x, parentPos.y, x, y, connectionClass);
                connection.setAttribute('data-parent', parentPos.data.id);
                container.appendChild(connection);
                
                // Animate in
                setTimeout(() => {
                    node.classList.add('visible');
                    connection.classList.add('visible');
                }, 50 + index * 100);
            });
        }
        
        function expandAllNodes() {
            nodePositions.forEach((pos, nodeId) => {
                if (pos.data.children && pos.data.children.length > 0 && !expandedNodes.has(nodeId)) {
                    toggleSubNodes(nodeId);
                }
            });
        }
        
        function collapseAllNodes() {
            // Collapse in reverse order (children first)
            const nodesToCollapse = Array.from(expandedNodes);
            nodesToCollapse.reverse().forEach(nodeId => {
                if (expandedNodes.has(nodeId)) {
                    toggleSubNodes(nodeId);
                }
            });
        }
        
        function applyTransform() {
            const mindMap = document.getElementById('mindMap');
            mindMap.style.transform = \`scale(\${currentZoom}) translate(\${currentTransform.x}px, \${currentTransform.y}px)\`;
        }
        
        // Event listeners
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
        
        // Drag and pan functionality
        const container = document.querySelector('.mind-map-container');
        
        container.addEventListener('mousedown', (e) => {
            if (e.target === container || e.target.id === 'mindMap') {
                isDragging = true;
                dragStart = { x: e.clientX - currentTransform.x, y: e.clientY - currentTransform.y };
                container.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                currentTransform.x = e.clientX - dragStart.x;
                currentTransform.y = e.clientY - dragStart.y;
                applyTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = 'grab';
        });
        
        // Zoom with mouse wheel
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            currentZoom = Math.max(0.3, Math.min(3, currentZoom * zoomFactor));
            applyTransform();
        });
        
        // Initialize
        window.addEventListener('load', () => {
            layoutNodes();
        });
        
        window.addEventListener('resize', () => {
            layoutNodes();
        });
    </script>
</body>
</html>`;
} 