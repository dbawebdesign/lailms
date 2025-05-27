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
  type: 'root' | 'main' | 'sub' | 'detail';
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

## Visual Hierarchy & Structure
1. **Root Node**: Single, clear main topic (2-4 words maximum)
2. **Main Branches**: 3-5 key concepts, each representing a major theme
3. **Sub-branches**: 2-4 supporting details per main branch
4. **Label Quality**: Concise, descriptive labels (avoid long sentences)
5. **Logical Flow**: Organize content from general to specific

## Professional Styling Guidelines
- **Consistency**: All nodes at the same level should have similar length labels
- **Clarity**: Use simple, grade-appropriate terminology
- **Balance**: Distribute content evenly across branches
- **Hierarchy**: Clear visual distinction between levels
- **Alignment**: Ensure proper spacing and professional appearance

## Content Organization Rules
- **Root**: Main lesson topic (e.g., "Life in the Colonies")
- **Main Branches**: Core concepts (e.g., "Social Structure", "Economic Activities")
- **Sub-branches**: Specific details (e.g., "Colonial Classes", "Trade Routes")
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
            "color": "#34D399"
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
            padding: 12px 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
            letter-spacing: -0.01em;
            line-height: 1.3;
            word-wrap: break-word;
            hyphens: auto;
        }
        
        .mind-map-node:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        .root-node {
            width: 200px;
            height: 200px;
            background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%);
            font-size: 20px;
            font-weight: 700;
            z-index: 5;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
        }
        
        .main-node {
            width: 160px;
            height: 56px;
            font-size: 15px;
            border-radius: 28px;
            z-index: 4;
            position: relative;
            min-width: 140px;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .sub-node {
            width: 130px;
            height: 44px;
            font-size: 13px;
            border-radius: 22px;
            z-index: 3;
            opacity: 0;
            transform: scale(0);
            min-width: 110px;
            max-width: 160px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .sub-node.visible {
            opacity: 1;
            transform: scale(1);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .connection-line {
            position: absolute;
            background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.15) 100%);
            transform-origin: left center;
            z-index: 1;
            height: 3px;
            border-radius: 1.5px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
            font-size: 16px;
            transition: transform 0.3s ease;
        }
        
        .expand-indicator.expanded {
            transform: translateY(-50%) rotate(90deg);
        }
        
        .controls {
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 8px;
            z-index: 40;
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
        }
        
        .control-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }
        
        .help-text {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <h1 class="mind-map-title">${title}</h1>
        
        <!-- Controls -->
        <div class="controls">
            <button class="control-btn" id="zoomIn" title="Zoom In">🔍+</button>
            <button class="control-btn" id="zoomOut" title="Zoom Out">🔍-</button>
            <button class="control-btn" id="resetView" title="Reset View">⌂</button>
            <button class="control-btn" id="expandAll" title="Expand All">⤢</button>
        </div>
        
        <!-- Help Text -->
        <div class="help-text">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="width: 8px; height: 8px; background: #4A90E2; border-radius: 50%;"></span>
                <strong>Click branches to expand</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.8;">Use controls to zoom and navigate</div>
        </div>
        
        <div id="mindMap"></div>
    </div>
    
    <script>
        const mindMapData = ${JSON.stringify(rootNode)};
        let currentZoom = 1;
        let expandedNodes = new Set();
        let nodePositions = new Map();
        
        function createMindMap() {
            const container = document.getElementById('mindMap');
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            // Clear previous positions
            nodePositions.clear();
            
            // Create root node
            const rootNodeElement = createNode(mindMapData, 'root-node', centerX - 100, centerY - 100);
            container.appendChild(rootNodeElement);
            nodePositions.set(mindMapData.id, { x: centerX, y: centerY, width: 200, height: 200 });
            
            // Create main branches with improved layout
            if (mindMapData.children) {
                const mainNodes = layoutMainNodes(mindMapData.children, centerX, centerY);
                
                mainNodes.forEach((nodeLayout, index) => {
                    const child = mindMapData.children[index];
                    const { x, y, angle } = nodeLayout;
                    
                    // Create connection line
                    const line = createConnectionLine(centerX, centerY, x + 80, y + 28);
                    container.appendChild(line);
                    
                    // Create main node
                    const mainNode = createNode(child, 'main-node', x, y);
                    if (child.children && child.children.length > 0) {
                        const indicator = document.createElement('span');
                        indicator.className = 'expand-indicator';
                        indicator.textContent = '▶';
                        mainNode.appendChild(indicator);
                        
                        mainNode.addEventListener('click', () => toggleSubNodes(child, x + 80, y + 28, angle, mainNode));
                    }
                    container.appendChild(mainNode);
                    
                    // Store position for collision detection
                    nodePositions.set(child.id, { x: x + 80, y: y + 28, width: 160, height: 56 });
                });
            }
        }
        
        function layoutMainNodes(children, centerX, centerY) {
            const nodes = [];
            const baseDistance = 380; // Increased base distance for better spacing
            const minAngularSeparation = Math.PI / 3.5; // Minimum ~51 degrees between nodes for better spacing
            
            if (children.length <= 4) {
                // Use optimized circular layout for 4 or fewer nodes
                const angleStep = Math.max(minAngularSeparation, (2 * Math.PI) / children.length);
                const startAngle = -Math.PI / 2; // Start at top
                
                children.forEach((child, index) => {
                    const angle = startAngle + index * angleStep;
                    let distance = baseDistance;
                    
                    // Adjust distance based on node text length to avoid overlaps
                    const textLength = child.label.length;
                    if (textLength > 20) {
                        distance += 60;
                    } else if (textLength > 15) {
                        distance += 30;
                    }
                    
                    const x = centerX + Math.cos(angle) * distance - 80;
                    const y = centerY + Math.sin(angle) * distance - 28;
                    
                    nodes.push({ x, y, angle });
                });
            } else if (children.length <= 8) {
                // Use two rings for 5-8 nodes
                const innerCount = Math.min(4, children.length);
                const outerCount = children.length - innerCount;
                
                // Inner ring
                const innerAngleStep = (2 * Math.PI) / innerCount;
                for (let i = 0; i < innerCount; i++) {
                    const angle = -Math.PI / 2 + i * innerAngleStep;
                    const x = centerX + Math.cos(angle) * baseDistance - 70;
                    const y = centerY + Math.sin(angle) * baseDistance - 25;
                    nodes.push({ x, y, angle });
                }
                
                // Outer ring
                if (outerCount > 0) {
                    const outerAngleStep = (2 * Math.PI) / outerCount;
                    const outerDistance = baseDistance + 150;
                    const angleOffset = innerAngleStep / 2; // Offset to avoid overlaps
                    
                    for (let i = 0; i < outerCount; i++) {
                        const angle = -Math.PI / 2 + angleOffset + i * outerAngleStep;
                        const x = centerX + Math.cos(angle) * outerDistance - 70;
                        const y = centerY + Math.sin(angle) * outerDistance - 25;
                        nodes.push({ x, y, angle });
                    }
                }
            } else {
                // Use grid-like layout for many nodes
                const cols = Math.ceil(Math.sqrt(children.length));
                const rows = Math.ceil(children.length / cols);
                const spacing = 200;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    // Center the grid around the root
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing;
                    
                    const x = centerX + offsetX - 70;
                    const y = centerY + offsetY + 200 - 25; // Offset down from center
                    
                    // Calculate angle from center for sub-node positioning
                    const angle = Math.atan2(y + 25 - centerY, x + 70 - centerX);
                    
                    nodes.push({ x, y, angle });
                });
            }
            
            return nodes;
        }
        
        function createNode(nodeData, className, x, y) {
            const node = document.createElement('div');
            node.className = \`mind-map-node \${className}\`;
            node.style.left = x + 'px';
            node.style.top = y + 'px';
            node.textContent = nodeData.label;
            node.setAttribute('data-id', nodeData.id);
            
            // Apply color from node data if available
            if (nodeData.color) {
                if (className === 'root-node') {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -20)} 100%)\`;
                } else {
                    node.style.background = \`linear-gradient(135deg, \${nodeData.color} 0%, \${adjustBrightness(nodeData.color, -15)} 100%)\`;
                }
            }
            
            return node;
        }
        
        function adjustBrightness(hex, percent) {
            // Remove # if present
            hex = hex.replace('#', '');
            
            // Parse RGB values
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            // Adjust brightness
            const newR = Math.max(0, Math.min(255, r + (r * percent / 100)));
            const newG = Math.max(0, Math.min(255, g + (g * percent / 100)));
            const newB = Math.max(0, Math.min(255, b + (b * percent / 100)));
            
            // Convert back to hex
            return '#' + 
                Math.round(newR).toString(16).padStart(2, '0') +
                Math.round(newG).toString(16).padStart(2, '0') +
                Math.round(newB).toString(16).padStart(2, '0');
        }
        
        function createConnectionLine(x1, y1, x2, y2) {
            const line = document.createElement('div');
            line.className = 'connection-line';
            
            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            line.style.width = length + 'px';
            line.style.left = x1 + 'px';
            line.style.top = y1 + 'px';
            line.style.transform = \`rotate(\${angle}deg)\`;
            
            return line;
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
                    }
                    subLines.forEach(line => {
                        line.classList.remove('visible');
                        setTimeout(() => line.remove(), 300);
                    });
                });
                indicator.classList.remove('expanded');
            } else {
                // Show sub-nodes with improved layout
                expandedNodes.add(parentNode.id);
                const subNodePositions = layoutSubNodes(parentNode.children, parentX, parentY, parentAngle);
                
                parentNode.children.forEach((child, index) => {
                    const { x: subX, y: subY } = subNodePositions[index];
                    
                    // Create sub connection line
                    const subLine = createConnectionLine(parentX, parentY, subX + 65, subY + 22);
                    subLine.className += ' sub-connection-line';
                    subLine.setAttribute('data-parent', parentNode.id);
                    document.getElementById('mindMap').appendChild(subLine);
                    
                    // Create sub node
                    const subNode = createNode(child, 'sub-node', subX, subY);
                    document.getElementById('mindMap').appendChild(subNode);
                    
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
            const subDistance = 220; // Increased distance for better spacing
            const minSubAngle = Math.PI / 4.5; // Minimum ~40 degrees between sub-nodes
            const maxSpread = Math.PI * 0.8; // Maximum 144 degrees spread for tighter grouping
            
            if (children.length === 1) {
                // Single sub-node: place directly away from center
                const angle = parentAngle;
                const x = parentX + Math.cos(angle) * subDistance - 65;
                const y = parentY + Math.sin(angle) * subDistance - 22;
                positions.push({ x, y });
            } else if (children.length <= 4) {
                // Few sub-nodes: use symmetric arc
                const angleSpread = Math.min(maxSpread, (children.length - 1) * minSubAngle);
                const startAngle = parentAngle - angleSpread / 2;
                
                children.forEach((child, index) => {
                    const angle = children.length === 1 ? 
                        startAngle : 
                        startAngle + (index * angleSpread / (children.length - 1));
                    const x = parentX + Math.cos(angle) * subDistance - 60;
                    const y = parentY + Math.sin(angle) * subDistance - 20;
                    positions.push({ x, y });
                });
            } else {
                // Many sub-nodes: use organized grid pattern
                const cols = Math.min(3, children.length); // Max 3 columns
                const rows = Math.ceil(children.length / cols);
                const spacing = 140;
                
                // Calculate grid center relative to parent
                const gridCenterX = parentX + Math.cos(parentAngle) * subDistance;
                const gridCenterY = parentY + Math.sin(parentAngle) * subDistance;
                
                children.forEach((child, index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    // Center the grid
                    const offsetX = (col - (cols - 1) / 2) * spacing;
                    const offsetY = (row - (rows - 1) / 2) * spacing * 0.7; // Compress vertically
                    
                    const x = gridCenterX + offsetX - 60;
                    const y = gridCenterY + offsetY - 20;
                    positions.push({ x, y });
                });
            }
            
            return positions;
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
        
        document.getElementById('expandAll').addEventListener('click', () => {
            expandAllNodes();
        });
        
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
        
        function expandAllNodes() {
            const mainNodes = document.querySelectorAll('.main-node');
            mainNodes.forEach((nodeElement, index) => {
                const indicator = nodeElement.querySelector('.expand-indicator');
                if (indicator && !indicator.classList.contains('expanded')) {
                    setTimeout(() => {
                        nodeElement.click();
                    }, index * 200); // Stagger the animations
                }
            });
        }
        
        // Add mouse wheel zoom
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
        
        // Add drag to pan functionality
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
        
        // Add keyboard shortcuts
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