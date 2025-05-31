import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Props {
  params: Promise<{ baseClassId: string }>;
}

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

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { baseClassId } = await params;
    const supabase = createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';

    // Check for existing mind map
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

    if (regenerate && existingAssets && existingAssets.length > 0) {
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
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
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
    const prompt = `Create a comprehensive mind map from this course content. Extract and organize the ACTUAL content.

COURSE STRUCTURE:
${JSON.stringify(courseContent, null, 2)}

REQUIREMENTS:
1. Center: Course title with brief description
2. Main branches: Course modules/paths (up to 6, numbered)
3. Sub-branches: Key lessons from each module
4. Detail nodes: Important concepts from lesson sections
5. Include rich descriptions for each node
6. Use actual content from the provided structure

OUTPUT FORMAT (valid JSON only):
{
  "center": {
    "label": "${courseContent.title}",
    "description": "Course overview"
  },
  "branches": [
      {
        "id": "module1",
      "label": "1. Module Name",
      "description": "Module description",
      "color": "#DC2626",
      "concepts": [
        {
          "label": "Concept Name",
          "description": "Detailed explanation",
          "details": [
            {
              "label": "Key Point",
              "description": "Specific detail"
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
        { role: 'system', content: 'You create educational mind maps. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    let mindMapData;
    try {
      const responseText = aiResponse.choices[0]?.message?.content || '{}';
      const cleanedJson = responseText.replace(/```json\s*|\s*```/g, '').trim();
      mindMapData = JSON.parse(cleanedJson);
    } catch (error) {
      // Fallback structure
      const colors = ['#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D'];
      mindMapData = {
        center: {
          label: courseContent.title,
          description: courseContent.description || 'Comprehensive course'
        },
        branches: courseContent.modules.slice(0, 6).map((module: any, index: number) => ({
          id: `module${index + 1}`,
          label: `${index + 1}. ${module.title}`,
          description: module.description || `Learn ${module.title}`,
          color: colors[index],
          concepts: module.lessons.slice(0, 4).map((lesson: any) => ({
            label: lesson.title,
            description: lesson.description || `Key concepts in ${lesson.title}`,
            details: lesson.concepts.slice(0, 3).map((concept: any) => ({
              label: concept.title,
              description: concept.content.substring(0, 150) || `Important aspects of ${concept.title}`
            }))
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
        title: `${baseClass.name} Mind Map`,
        content: mindMapData,
        svg_content: svgHtml,
      status: 'completed',
      created_by: user.id
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        url: `/api/teach/media/base-class-mind-map/${asset.id}`,
        title: asset.title
      }
    });

  } catch (error) {
    console.error('Mind map generation error:', error);
    return NextResponse.json({ error: 'Failed to generate mind map' }, { status: 500 });
  }
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            color: #ffffff;
            overflow: hidden;
            height: 100vh;
            user-select: none;
        }
        
        .mind-map-container {
            width: 100%;
            height: 100vh;
            position: relative;
            cursor: grab;
        }
        
        .mind-map-container:active { cursor: grabbing; }
        
        #mindMapSvg {
            width: 100%;
            height: 100%;
            background: transparent;
        }
        
        .center-node { filter: drop-shadow(0 8px 32px rgba(0, 0, 0, 0.3)); }
        
        .main-branch {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
        }
        
        .main-branch:hover {
            transform: scale(1.05);
            filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.4));
        }
        
        .concept-node, .detail-node {
            transition: all 0.2s ease;
            cursor: pointer;
        }
        
        .concept-node:hover { transform: scale(1.08); }
        .detail-node:hover { transform: scale(1.1); }
        
        .connection-line {
            transition: stroke-width 0.3s ease;
        }
        
        .expandable {
            opacity: 0;
            transform: scale(0);
            transform-origin: center;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .expandable.visible {
            opacity: 1;
            transform: scale(1);
        }
        
        .controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 1000;
        }
        
        .control-group {
            display: flex;
            gap: 8px;
            background: rgba(15, 23, 42, 0.8);
            padding: 8px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .control-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            min-width: 40px;
            text-align: center;
        }
        
        .control-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }
        
        .info-panel {
            position: fixed;
            top: 20px;
            left: 20px;
            max-width: 300px;
            background: rgba(15, 23, 42, 0.9);
            padding: 16px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 1000;
        }
        
        .info-panel.visible { transform: translateX(0); }
        
        .info-panel h3 {
            margin-bottom: 8px;
            color: #f1f5f9;
            font-size: 16px;
        }
        
        .info-panel p {
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <svg id="mindMapSvg" viewBox="0 0 1200 800">
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                
                <filter id="shadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
                </filter>
                
                <linearGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#1e293b"/>
                    <stop offset="100%" stop-color="#0f172a"/>
                </linearGradient>
            </defs>
            
            <g id="connectionsGroup"></g>
            <g id="nodesGroup"></g>
        </svg>
    </div>
    
    <div class="info-panel" id="infoPanel">
        <h3 id="infoTitle">Select a node</h3>
        <p id="infoDescription">Click on any node to view detailed information</p>
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
        
        const svg = document.getElementById('mindMapSvg');
        const nodesGroup = document.getElementById('nodesGroup');
        const connectionsGroup = document.getElementById('connectionsGroup');
        const infoPanel = document.getElementById('infoPanel');
        
        function initializeMindMap() {
            drawMindMap();
            setupEventListeners();
        }
        
        function drawMindMap() {
            const centerX = 600;
            const centerY = 400;
            
            nodesGroup.innerHTML = '';
            connectionsGroup.innerHTML = '';
            
            drawCenterNode(centerX, centerY);
            
            const branches = mindMapData.branches || [];
            const angleStep = (Math.PI * 2) / branches.length;
            
            branches.forEach((branch, index) => {
                const angle = -Math.PI / 2 + (index * angleStep);
                const radius = 280;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                drawMainBranch(x, y, branch, centerX, centerY, angle, index);
            });
        }
        
        function drawCenterNode(x, y) {
            const centerData = mindMapData.center;
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '60');
            circle.setAttribute('fill', 'url(#centerGradient)');
            circle.setAttribute('stroke', '#475569');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('class', 'center-node');
            circle.setAttribute('filter', 'url(#shadow)');
            
            const text = createWrappedText(x, y, centerData.label, {
                maxWidth: 100,
                fontSize: 14,
                fontWeight: 'bold',
                fill: '#f1f5f9'
            });
            
            nodesGroup.appendChild(circle);
            nodesGroup.appendChild(text);
            
            circle.addEventListener('click', () => showNodeInfo(centerData.label, centerData.description));
        }
        
        function drawMainBranch(x, y, branchData, centerX, centerY, angle, index) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const path = createCurvedPath(centerX, centerY, x, y);
            line.setAttribute('d', path);
            line.setAttribute('stroke', branchData.color);
            line.setAttribute('stroke-width', '3');
            line.setAttribute('fill', 'none');
            line.setAttribute('class', 'connection-line');
            line.setAttribute('opacity', '0.8');
            connectionsGroup.appendChild(line);
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const textWidth = branchData.label.length * 8;
            const width = Math.max(textWidth + 40, 120);
            const height = 40;
            
            rect.setAttribute('x', x - width/2);
            rect.setAttribute('y', y - height/2);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', '20');
            rect.setAttribute('fill', branchData.color);
            rect.setAttribute('class', 'main-branch');
            rect.setAttribute('filter', 'url(#shadow)');
            rect.setAttribute('data-branch', index);
            
            const text = createWrappedText(x, y, branchData.label, {
                maxWidth: width - 20,
                fontSize: 13,
                fontWeight: 'bold',
                fill: '#ffffff'
            });
            
            nodesGroup.appendChild(rect);
            nodesGroup.appendChild(text);
            
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBranch(index, x, y, branchData, angle);
                showNodeInfo(branchData.label, branchData.description);
            });
            
            if (expandedNodes.has(index)) {
                drawConcepts(x, y, branchData, angle, index);
            }
        }
        
        function drawConcepts(branchX, branchY, branchData, branchAngle, branchIndex) {
            const concepts = branchData.concepts || [];
            
            concepts.forEach((concept, conceptIndex) => {
                const conceptAngle = branchAngle + (conceptIndex - (concepts.length - 1) / 2) * 0.4;
                const conceptRadius = 160;
                const conceptX = branchX + Math.cos(conceptAngle) * conceptRadius;
                const conceptY = branchY + Math.sin(conceptAngle) * conceptRadius;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const path = createCurvedPath(branchX, branchY, conceptX, conceptY);
                line.setAttribute('d', path);
                line.setAttribute('stroke', branchData.color);
                line.setAttribute('stroke-width', '2');
                line.setAttribute('fill', 'none');
                line.setAttribute('class', 'connection-line expandable visible');
                line.setAttribute('opacity', '0.6');
                connectionsGroup.appendChild(line);
                
                const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                const textWidth = concept.label.length * 6;
                const width = Math.max(textWidth + 30, 80);
                
                ellipse.setAttribute('cx', conceptX);
                ellipse.setAttribute('cy', conceptY);
                ellipse.setAttribute('rx', width/2);
                ellipse.setAttribute('ry', '18');
                ellipse.setAttribute('fill', branchData.color + '40');
                ellipse.setAttribute('stroke', branchData.color);
                ellipse.setAttribute('stroke-width', '1.5');
                ellipse.setAttribute('class', 'concept-node expandable visible');
                ellipse.setAttribute('data-concept', \`\${branchIndex}-\${conceptIndex}\`);
                
                const text = createWrappedText(conceptX, conceptY, concept.label, {
                    maxWidth: width - 10,
                    fontSize: 11,
                    fill: '#e2e8f0'
                });
                text.setAttribute('class', 'expandable visible');
                
                nodesGroup.appendChild(ellipse);
                nodesGroup.appendChild(text);
                
                ellipse.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleConcept(branchIndex, conceptIndex, conceptX, conceptY, concept, conceptAngle);
                    showNodeInfo(concept.label, concept.description);
                });
                
                const conceptKey = \`\${branchIndex}-\${conceptIndex}\`;
                if (expandedNodes.has(conceptKey)) {
                    drawDetails(conceptX, conceptY, concept, conceptAngle, branchData.color);
                }
            });
        }
        
        function drawDetails(conceptX, conceptY, conceptData, conceptAngle, color) {
            const details = conceptData.details || [];
            
            details.forEach((detail, detailIndex) => {
                const detailAngle = conceptAngle + (detailIndex - (details.length - 1) / 2) * 0.6;
                const detailRadius = 100;
                const detailX = conceptX + Math.cos(detailAngle) * detailRadius;
                const detailY = conceptY + Math.sin(detailAngle) * detailRadius;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', conceptX);
                line.setAttribute('y1', conceptY);
                line.setAttribute('x2', detailX);
                line.setAttribute('y2', detailY);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '1');
                line.setAttribute('class', 'connection-line expandable visible');
                line.setAttribute('opacity', '0.4');
                connectionsGroup.appendChild(line);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', detailX);
                circle.setAttribute('cy', detailY);
                circle.setAttribute('r', '12');
                circle.setAttribute('fill', color + '20');
                circle.setAttribute('stroke', color);
                circle.setAttribute('stroke-width', '1');
                circle.setAttribute('class', 'detail-node expandable visible');
                
                const text = createWrappedText(detailX, detailY, detail.label, {
                    maxWidth: 60,
                    fontSize: 9,
                    fill: '#cbd5e1'
                });
                text.setAttribute('class', 'expandable visible');
                
                nodesGroup.appendChild(circle);
                nodesGroup.appendChild(text);
                
                circle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showNodeInfo(detail.label, detail.description);
                });
            });
        }
        
        function createCurvedPath(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dr = Math.sqrt(dx * dx + dy * dy);
            const sweep = dx > 0 ? 1 : 0;
            return \`M\${x1},\${y1} A\${dr},\${dr} 0 0,\${sweep} \${x2},\${y2}\`;
        }
        
        function createWrappedText(x, y, text, options = {}) {
            const { maxWidth = 100, fontSize = 12, fontWeight = 'normal', fill = '#ffffff' } = options;
            
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', x);
            textElement.setAttribute('y', y);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('font-size', fontSize);
            textElement.setAttribute('font-weight', fontWeight);
            textElement.setAttribute('fill', fill);
            textElement.setAttribute('class', 'node-text');
            
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
            if (expandedNodes.has(branchIndex)) {
                expandedNodes.delete(branchIndex);
                document.querySelectorAll(\`.expandable\`).forEach(el => {
                    if (el.getAttribute('data-concept')?.startsWith(\`\${branchIndex}-\`)) {
                        el.remove();
                    }
                });
            } else {
                expandedNodes.add(branchIndex);
                drawConcepts(x, y, branchData, angle, branchIndex);
            }
        }
        
        function toggleConcept(branchIndex, conceptIndex, x, y, conceptData, angle) {
            const conceptKey = \`\${branchIndex}-\${conceptIndex}\`;
            if (expandedNodes.has(conceptKey)) {
                expandedNodes.delete(conceptKey);
            } else {
                expandedNodes.add(conceptKey);
                const branch = mindMapData.branches[branchIndex];
                drawDetails(x, y, conceptData, angle, branch.color);
            }
        }
        
        function showNodeInfo(title, description) {
            document.getElementById('infoTitle').textContent = title;
            document.getElementById('infoDescription').textContent = description || 'No description available';
            infoPanel.classList.add('visible');
        }
        
        function setupEventListeners() {
            svg.addEventListener('mousedown', startDrag);
            svg.addEventListener('mousemove', drag);
            svg.addEventListener('mouseup', endDrag);
            svg.addEventListener('wheel', zoom);
            
            document.addEventListener('click', (e) => {
                if (!infoPanel.contains(e.target) && !e.target.closest('.main-branch, .concept-node, .detail-node, .center-node')) {
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
            currentScale = Math.max(0.2, Math.min(3, currentScale * delta));
            updateTransform();
        }
        
        function updateTransform() {
            nodesGroup.setAttribute('transform', \`translate(\${currentTranslateX}, \${currentTranslateY}) scale(\${currentScale})\`);
            connectionsGroup.setAttribute('transform', \`translate(\${currentTranslateX}, \${currentTranslateY}) scale(\${currentScale})\`);
        }
        
        function zoomIn() {
            currentScale = Math.min(3, currentScale * 1.2);
            updateTransform();
        }
        
        function zoomOut() {
            currentScale = Math.max(0.2, currentScale * 0.8);
            updateTransform();
        }
        
        function resetView() {
            currentScale = 1;
            currentTranslateX = 0;
            currentTranslateY = 0;
            updateTransform();
        }
        
        function expandAll() {
            mindMapData.branches.forEach((branch, index) => {
                expandedNodes.add(index);
                branch.concepts?.forEach((concept, conceptIndex) => {
                    expandedNodes.add(\`\${index}-\${conceptIndex}\`);
                });
            });
            drawMindMap();
        }
        
        function collapseAll() {
            expandedNodes.clear();
            drawMindMap();
        }
        
        document.addEventListener('DOMContentLoaded', initializeMindMap);
    </script>
</body>
</html>`;
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { baseClassId } = await params;
    const supabase = createSupabaseServerClient();

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
          ...assets[0],
          url: `/api/teach/media/base-class-mind-map/${assets[0].id}`
        }
      });
    }

    return NextResponse.json({ exists: false, asset: null });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check mind map' }, { status: 500 });
  }
} 