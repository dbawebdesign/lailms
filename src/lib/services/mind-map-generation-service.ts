import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

/**
 * Mind Map Generation Service
 * 
 * Production-ready service for generating lesson and base class mind maps.
 * Used by both API routes and internal course generation orchestrator.
 * 
 * Features:
 * - Direct function calls (no HTTP requests)
 * - Comprehensive error handling
 * - Detailed logging
 * - Retry logic
 * - Support for both lesson and base class mind maps
 */

export interface MindMapGenerationResult {
  success: boolean;
  asset?: {
    id: string;
    url: string;
    title: string;
  };
  mindMapData?: any;
  svgHtml?: string;
  error?: string;
}

export interface MindMapGenerationOptions {
  regenerate?: boolean;
  internal?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class MindMapGenerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate mind map for a lesson
   */
  async generateLessonMindMap(
    supabase: any,
    lessonId: string,
    user: { id: string },
    options: MindMapGenerationOptions = {}
  ): Promise<MindMapGenerationResult> {
    const { regenerate = false, maxRetries = 3, retryDelay = 2000 } = options;
    
    console.log(`🧠 [MindMapService] Starting lesson mind map generation for lesson: ${lessonId}`);
    
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`🧠 [MindMapService] Attempt ${retryCount + 1}/${maxRetries} for lesson: ${lessonId}`);
        
        const result = await this._generateLessonMindMapInternal(supabase, lessonId, user, regenerate);
        
        console.log(`✅ [MindMapService] Successfully generated mind map for lesson: ${lessonId}`);
        return {
          success: true,
          ...result
        };
        
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        console.error(`🧠 [MindMapService] Attempt ${retryCount}/${maxRetries} failed for lesson ${lessonId}:`, error);
        
        // Check if this is a retryable error
        if (this._isRetryableError(error as Error) && retryCount < maxRetries) {
          console.log(`🧠 [MindMapService] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }

    const errorMessage = `Failed to generate lesson mind map after ${maxRetries} attempts: ${lastError?.message}`;
    console.error(`❌ [MindMapService] ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * Generate mind map for a base class
   */
  async generateBaseClassMindMap(
    supabase: any,
    baseClassId: string,
    user: { id: string },
    options: MindMapGenerationOptions = {}
  ): Promise<MindMapGenerationResult> {
    const { regenerate = false, maxRetries = 3, retryDelay = 2000 } = options;
    
    console.log(`🧠 [MindMapService] Starting base class mind map generation for class: ${baseClassId}`);
    
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`🧠 [MindMapService] Attempt ${retryCount + 1}/${maxRetries} for base class: ${baseClassId}`);
        
        const result = await this._generateBaseClassMindMapInternal(supabase, baseClassId, user, regenerate);
        
        console.log(`✅ [MindMapService] Successfully generated mind map for base class: ${baseClassId}`);
        return {
          success: true,
          ...result
        };
        
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        console.error(`🧠 [MindMapService] Attempt ${retryCount}/${maxRetries} failed for base class ${baseClassId}:`, error);
        
        // Check if this is a retryable error
        if (this._isRetryableError(error as Error) && retryCount < maxRetries) {
          console.log(`🧠 [MindMapService] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }

    const errorMessage = `Failed to generate base class mind map after ${maxRetries} attempts: ${lastError?.message}`;
    console.error(`❌ [MindMapService] ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * Internal lesson mind map generation logic
   */
  private async _generateLessonMindMapInternal(
    supabase: any,
    lessonId: string,
    user: { id: string },
    regenerate: boolean
  ) {
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
    console.log('🔍 [MindMapService] Fetching lesson for mind map:', lessonId);
    
    // First, get the lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('title, description')
      .eq('id', lessonId)
      .single();

    console.log('📊 [MindMapService] Lesson query result:', { lesson: !!lesson, error: lessonError });

    if (!lesson) {
      console.error('❌ [MindMapService] Lesson not found for mind map:', { lessonId, error: lessonError });
      throw new Error(`Lesson not found: ${lessonError?.message || 'Unknown error'}`);
    }

    // Then, get the lesson sections
    const { data: lessonSections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('title, content, section_type, order_index')
      .eq('lesson_id', lessonId)
      .order('order_index');

    console.log('📊 [MindMapService] Lesson sections query result:', { 
      sectionsCount: lessonSections?.length || 0, 
      error: sectionsError 
    });

    if (sectionsError) {
      console.error('❌ [MindMapService] Failed to fetch lesson sections:', { lessonId, error: sectionsError });
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
        const content = this._extractTextContent(section.content);
        const keyPoints = this._extractKeyPoints(content);
        const detailedConcepts = this._extractDetailedConcepts(content);
        
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

    // Generate mind map with AI - using original format that produces correct structure
    const prompt = `Create a comprehensive educational mind map from this lesson content. Extract actual content and organize it in a clear hierarchical structure.

LESSON CONTENT:
Title: ${lessonContent.title}
Description: ${lessonContent.description}

SECTIONS:
${lessonContent.sections.map((section: any, index: number) => `
Section ${index + 1}: ${section.title}
Content: ${section.content}
Key Points: ${section.keyPoints?.join(', ') || 'N/A'}
`).join('\n')}

REQUIREMENTS:
1. Create a 4-level hierarchical mind map
2. Center: "${lessonContent.title}" with lesson description
3. Level 1 (branches): Main lesson sections with unique IDs and colors
4. Level 2 (concepts): Key concepts from each section (2-4 per branch)
5. Level 3 (points): Important points for each concept (2-3 per concept)
6. Level 4 (details): Specific details and examples (1-2 per point)
7. Use actual content from the lesson sections
8. Each level should have meaningful descriptions that teach the content

OUTPUT FORMAT (valid JSON only):
{
  "center": {
    "label": "${lessonContent.title}",
    "description": "${lessonContent.description || 'This lesson introduces students to key concepts and practical applications.'}"
  },
  "branches": [
    {
      "id": "section1",
      "color": "#DC2626",
      "label": "Section Title",
      "concepts": [
        {
          "id": "concept1",
          "label": "Concept Name",
          "description": "Clear explanation of what this concept covers and why it's important.",
          "points": [
            {
              "id": "point1",
              "label": "Key Point",
              "description": "Detailed explanation of this point with context and examples.",
              "details": [
                {
                  "id": "detail1",
                  "label": "Specific Detail",
                  "description": "Specific example, application, or deeper explanation of this detail."
                }
              ]
            }
          ]
        }
      ],
      "description": "Overview of what students will learn in this section."
    }
  ]
}

Use these colors in order: #DC2626, #059669, #7C3AED, #EA580C, #0891B2, #BE185D`;

    console.log('🤖 [MindMapService] Calling OpenAI for mind map generation...');
    
    const aiResponse = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You are an expert educational mind map creator. Create comprehensive 4-level hierarchical mind maps from lesson content. Always return valid JSON with the exact structure: center, branches (with concepts array), concepts (with points array), points (with details array). Use actual educational content, not meta-descriptions.' },
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
      console.log('✅ [MindMapService] Successfully parsed AI response');
    } catch (error) {
      console.warn('⚠️ [MindMapService] Failed to parse AI response, using fallback structure');
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
    console.log('🎨 [MindMapService] Generating SVG visualization...');
    const svgHtml = this._generateInteractiveSVGMindMap(mindMapData, lessonContent.title);

    // Save to database
    console.log('💾 [MindMapService] Saving mind map to database...');
    const { data: asset, error: saveError } = await supabase
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

    if (saveError) {
      console.error('❌ [MindMapService] Failed to save mind map to database:', saveError);
      throw new Error(`Failed to save mind map: ${saveError.message}`);
    }

    console.log('✅ [MindMapService] Mind map saved successfully with ID:', asset.id);

    return {
      mindMapData,
      svgHtml,
      asset: {
        id: asset.id,
        url: `/api/teach/media/mind-map/${asset.id}`,
        title: asset.title
      }
    };
  }

  /**
   * Internal base class mind map generation logic
   */
  private async _generateBaseClassMindMapInternal(
    supabase: any,
    baseClassId: string,
    user: { id: string },
    regenerate: boolean
  ) {
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

    // Fetch base class with modules and lessons
    console.log('🔍 [MindMapService] Fetching base class for mind map:', baseClassId);
    
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select(`
        title,
        description,
        modules:base_class_modules!base_class_id (
          title,
          description,
          order_index,
          lessons:lessons!module_id (
            title,
            description,
            order_index
          )
        )
      `)
      .eq('id', baseClassId)
      .single();

    if (!baseClass || baseClassError) {
      console.error('❌ [MindMapService] Base class not found:', { baseClassId, error: baseClassError });
      throw new Error(`Base class not found: ${baseClassError?.message || 'Unknown error'}`);
    }

    // Process course content
    const courseContent = {
      title: baseClass.title,
      description: baseClass.description || '',
      modules: (baseClass.modules || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((module: any) => ({
          title: module.title,
          description: module.description || '',
          lessons: (module.lessons || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((lesson: any) => ({
              title: lesson.title,
              description: lesson.description || ''
            }))
        }))
    };

    // Generate mind map with AI
    const prompt = `Create a comprehensive course mind map from this base class structure.

COURSE STRUCTURE:
${JSON.stringify(courseContent, null, 2)}

Create a 5-level hierarchical mind map:
1. Center: Course title
2. Level 1: Modules (main branches)
3. Level 2: Lessons/Topics within each module
4. Level 3: Key learning points for each lesson
5. Level 4: Specific details and applications

OUTPUT FORMAT (JSON only):
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

    console.log('🤖 [MindMapService] Calling OpenAI for base class mind map generation...');

    const aiResponse = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You are an expert educational mind map creator. Create comprehensive 4-level hierarchical mind maps from lesson content. Always return valid JSON with the exact structure: center, branches (with concepts array), concepts (with points array), points (with details array). Use actual educational content, not meta-descriptions.' },
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
      
      console.log('✅ [MindMapService] Successfully parsed AI response for base class');
    } catch (error) {
      console.warn('⚠️ [MindMapService] Failed to parse AI response for base class, using fallback structure');
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
          description: module.description || 'Module overview',
          color: colors[index],
          concepts: module.lessons.slice(0, 5).map((lesson: any, lessonIndex: number) => ({
            id: `lesson${index + 1}_${lessonIndex + 1}`,
            label: lesson.title,
            description: lesson.description || 'Lesson overview',
            points: [
              {
                id: `point${index + 1}_${lessonIndex + 1}_1`,
                label: 'Key Concept',
                description: 'Important learning objective for this lesson',
                details: [
                  {
                    id: `detail${index + 1}_${lessonIndex + 1}_1_1`,
                    label: 'Application',
                    description: 'Practical application of the concept'
                  }
                ]
              }
            ]
          }))
        }))
      };
    }

    // Generate SVG
    console.log('🎨 [MindMapService] Generating SVG visualization for base class...');
    const svgHtml = this._generateInteractiveSVGMindMap(mindMapData, courseContent.title);

    // Save to database
    console.log('💾 [MindMapService] Saving base class mind map to database...');
    const { data: asset, error: saveError } = await supabase
      .from('base_class_media_assets')
      .insert({
        base_class_id: baseClassId,
        asset_type: 'mind_map',
        title: courseContent.title,
        content: mindMapData,
        svg_content: svgHtml,
        status: 'completed',
        created_by: user.id
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [MindMapService] Failed to save base class mind map to database:', saveError);
      throw new Error(`Failed to save base class mind map: ${saveError.message}`);
    }

    console.log('✅ [MindMapService] Base class mind map saved successfully with ID:', asset.id);

    return {
      mindMapData,
      svgHtml,
      asset: {
        id: asset.id,
        url: `/api/teach/media/mind-map/${asset.id}`,
        title: asset.title
      }
    };
  }

  /**
   * Check if an error is retryable
   */
  private _isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'Lesson not found',
      'Base class not found',
      'Failed to fetch lesson sections',
      'Connection timeout',
      'Network error',
      'Rate limit'
    ];
    
    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Extract text content from JSONB
   */
  private _extractTextContent(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    
    if (content.type === 'doc' && content.content) {
      return this._extractFromNodes(content.content);
    }
    
    return '';
  }

  private _extractFromNodes(nodes: any[]): string {
    if (!Array.isArray(nodes)) return '';
    
    return nodes.map(node => {
      if (node.type === 'text') return node.text || '';
      if (node.type === 'paragraph' && node.content) {
        return this._extractFromNodes(node.content) + '\n';
      }
      if (node.type === 'heading' && node.content) {
        return this._extractFromNodes(node.content) + '\n';
      }
      if (node.content) return this._extractFromNodes(node.content);
      return '';
    }).join('');
  }

  private _extractDetailedConcepts(content: string): any[] {
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
          details: this._extractDetailsFromSentence(sentence)
        }))
      };
    });
  }

  private _extractDetailsFromSentence(sentence: string): any[] {
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

  private _extractKeyPoints(content: string): string[] {
    if (!content) return [];
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 6).map(s => s.trim());
  }

  /**
   * Generate interactive SVG mind map using the EXACT same approach as the working React components
   * This recreates the precise visual layout and styling from MindMapViewer.tsx
   */
  private _generateInteractiveSVGMindMap(data: any, title: string): string {
    // Use the exact same positioning algorithm as the React component
    const allNodes: any[] = [];
    const nodePositions: any[] = [];

    // Center node - exact same as React component
    const centerNode = {
      id: 'center',
      label: data.center?.label || title,
      description: data.center?.description || '',
      level: 0,
      x: 0,
      y: 0,
      children: [],
      isExpanded: true
    };

    allNodes.push(centerNode);
    nodePositions.push({ id: 'center', x: 0, y: 0, radius: 50 });

    // Process branches with EXACT same spacing as React component
    const branches = data.branches || [];
    branches.forEach((branch: any, branchIndex: number) => {
      const totalBranches = branches.length;
      const angle = (branchIndex * 2 * Math.PI) / totalBranches;
      // Use the exact same base radius calculation as React component
      const baseRadius = Math.max(450, totalBranches * 70);
      
      const baseX = centerNode.x + baseRadius * Math.cos(angle);
      const baseY = centerNode.y + baseRadius * Math.sin(angle);
      
      // Find non-colliding position (same algorithm as React)
      const { x, y } = this._findNonCollidingPosition(baseX, baseY, angle, 40, nodePositions);
      
      const branchNode = {
        id: branch.id || `branch_${branchIndex}`,
        label: branch.label || 'Untitled Branch',
        description: branch.description || '',
        color: branch.color || '#3B82F6',
        level: 1,
        x,
        y,
        children: [],
        isExpanded: true,
        parentId: 'center'
      };

      allNodes.push(branchNode);
      nodePositions.push({ id: branchNode.id, x, y, radius: 40 });

      // Process concepts with exact same algorithm
      if (branch.concepts && Array.isArray(branch.concepts)) {
        branch.concepts.forEach((concept: any, conceptIndex: number) => {
          const conceptCount = branch.concepts.length;
          const conceptAngleOffset = (conceptIndex - (conceptCount - 1) / 2) * (Math.PI / 6);
          const conceptAngle = angle + conceptAngleOffset;
          const conceptRadius = Math.max(280, conceptCount * 40);
          
          const baseConceptX = branchNode.x + conceptRadius * Math.cos(conceptAngle);
          const baseConceptY = branchNode.y + conceptRadius * Math.sin(conceptAngle);
          
          const { x: conceptX, y: conceptY } = this._findNonCollidingPosition(
            baseConceptX, 
            baseConceptY, 
            conceptAngle, 
            32, 
            nodePositions
          );
          
          const conceptNode = {
            id: concept.id || `concept_${branchIndex}_${conceptIndex}`,
            label: concept.label || 'Untitled Concept',
            description: concept.description || '',
            color: branchNode.color,
            level: 2,
            x: conceptX,
            y: conceptY,
            children: [],
            isExpanded: true,
            parentId: branchNode.id
          };

          allNodes.push(conceptNode);
          nodePositions.push({ id: conceptNode.id, x: conceptX, y: conceptY, radius: 32 });

          // Process points with exact same ring algorithm
          if (concept.points && Array.isArray(concept.points)) {
            concept.points.forEach((point: any, pointIndex: number) => {
              const pointCount = concept.points.length;
              const maxPointsPerRing = 4;
              const ringIndex = Math.floor(pointIndex / maxPointsPerRing);
              const positionInRing = pointIndex % maxPointsPerRing;
              const pointsInThisRing = Math.min(maxPointsPerRing, pointCount - (ringIndex * maxPointsPerRing));
              
              const ringRadius = Math.max(180, 80 + (ringIndex * 90));
              const ringSpread = Math.min(Math.PI * 0.8, pointsInThisRing * 0.5);
              const startAngle = conceptAngle - ringSpread / 2;
              
              let pointAngle;
              if (pointsInThisRing === 1) {
                pointAngle = conceptAngle;
              } else {
                pointAngle = startAngle + (positionInRing / (pointsInThisRing - 1)) * ringSpread;
              }
              
              const basePointX = conceptNode.x + ringRadius * Math.cos(pointAngle);
              const basePointY = conceptNode.y + ringRadius * Math.sin(pointAngle);
              
              const { x: pointX, y: pointY } = this._findNonCollidingPosition(
                basePointX, 
                basePointY, 
                pointAngle, 
                24, 
                nodePositions
              );
              
              const pointNode = {
                id: point.id || `point_${branchIndex}_${conceptIndex}_${pointIndex}`,
                label: point.label || 'Untitled Point',
                description: point.description || '',
                color: branchNode.color,
                level: 3,
                x: pointX,
                y: pointY,
                children: [],
                isExpanded: true,
                parentId: conceptNode.id
              };

              allNodes.push(pointNode);
              nodePositions.push({ id: pointNode.id, x: pointX, y: pointY, radius: 24 });

              // Process details
              if (point.details && Array.isArray(point.details)) {
                point.details.forEach((detail: any, detailIndex: number) => {
                  const detailCount = point.details.length;
                  const detailAngleOffset = (detailIndex - (detailCount - 1) / 2) * (Math.PI / 8);
                  const detailAngle = pointAngle + detailAngleOffset;
                  const detailRadius = 120;
                  
                  const baseDetailX = pointNode.x + detailRadius * Math.cos(detailAngle);
                  const baseDetailY = pointNode.y + detailRadius * Math.sin(detailAngle);
                  
                  const { x: detailX, y: detailY } = this._findNonCollidingPosition(
                    baseDetailX, 
                    baseDetailY, 
                    detailAngle, 
                    18, 
                    nodePositions
                  );
                  
                  const detailNode = {
                    id: detail.id || `detail_${branchIndex}_${conceptIndex}_${pointIndex}_${detailIndex}`,
                    label: detail.label || 'Untitled Detail',
                    description: detail.description || '',
                    color: branchNode.color,
                    level: 4,
                    x: detailX,
                    y: detailY,
                    children: [],
                    isExpanded: true,
                    parentId: pointNode.id
                  };

                  allNodes.push(detailNode);
                  nodePositions.push({ id: detailNode.id, x: detailX, y: detailY, radius: 18 });
                });
              }
            });
          }
        });
      }
    });

    // Generate connections using exact same approach
    const connections = allNodes
      .filter(node => node.parentId)
      .map(node => {
        const parent = allNodes.find(p => p.id === node.parentId);
        if (!parent) return '';
        
        return `<line x1="${parent.x}" y1="${parent.y}" x2="${node.x}" y2="${node.y}" 
                  stroke="${node.color || '#3B82F6'}" stroke-width="2" opacity="0.6" />`;
      })
      .join('');

    // Generate nodes using EXACT same styling as React component
    const nodes = allNodes.map(node => {
      // Use exact same sizing and text logic as React component
      const nodeRadius = node.level === 0 ? 50 : node.level === 1 ? 40 : node.level === 2 ? 32 : node.level === 3 ? 24 : 18;
      const textSize = node.level === 0 ? 11 : node.level === 1 ? 9 : node.level === 2 ? 8 : node.level === 3 ? 7 : 6;
      const maxLength = node.level === 0 ? 15 : node.level === 1 ? 12 : node.level === 2 ? 10 : 8;
      
      const nodeLabel = node.label || 'Untitled';
      const displayText = nodeLabel.length > maxLength ? nodeLabel.substring(0, maxLength) + '...' : nodeLabel;
      
      // Use exact same fill logic as React component
      const fillColor = node.level === 0 
        ? '#1F2937' 
        : node.level === 1 
          ? node.color || '#3B82F6' 
          : (node.color || '#3B82F6') + '80'; // Add transparency for level 2+
      
      const strokeColor = node.level === 0 ? '#374151' : node.color || '#3B82F6';
      const strokeWidth = node.level === 0 ? 3 : 2;
      
      return `
        <g class="node-group" data-node-id="${node.id}">
          <circle cx="${node.x}" cy="${node.y}" r="${nodeRadius}"
            fill="${fillColor}"
            stroke="${strokeColor}"
            stroke-width="${strokeWidth}"
            class="node-circle transition-all duration-200 cursor-pointer" />
          <text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="middle"
            fill="white" font-size="${textSize}" font-weight="${node.level <= 1 ? 'bold' : 'normal'}"
            class="node-text pointer-events-none select-none">${displayText}</text>
          <title>${node.label}${node.description ? ': ' + node.description : ''}</title>
        </g>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Interactive Mind Map</title>
    <style>
        body { 
          margin: 0; 
          padding: 0; 
          background: #0f172a; 
          color: white; 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
          overflow: hidden;
        }
        .mind-map-container { 
          width: 100vw; 
          height: 100vh; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          position: relative;
        }
        .mind-map-svg {
          width: 100%;
          height: 100%;
          cursor: grab;
        }
        .mind-map-svg:active {
          cursor: grabbing;
        }
        .node-circle {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .node-circle:hover {
          filter: brightness(1.2);
          stroke-width: 3;
        }
        .node-text {
          pointer-events: none;
          user-select: none;
        }
        .connections line {
          transition: opacity 0.2s ease;
        }
        .zoom-controls {
          position: absolute;
          bottom: 20px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 10;
        }
        .zoom-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(59, 130, 246, 0.8);
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }
        .zoom-btn:hover {
          background: rgba(59, 130, 246, 1);
        }
        .title-overlay {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.7);
          padding: 15px 20px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        .title-overlay h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        /* Node Details Panel */
        .node-details-panel {
          position: absolute;
          top: 80px;
          left: 20px;
          width: 300px;
          max-height: 400px;
          background: rgba(255, 255, 255, 0.95);
          color: #1f2937;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 10px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          z-index: 15;
          display: none;
          transition: all 0.2s ease;
        }
        .node-details-panel.show {
          display: block;
        }
        .node-details-header {
          display: flex;
          align-items: center;
          justify-content: between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(248, 250, 252, 0.5);
          border-radius: 10px 10px 0 0;
        }
        .node-details-title {
          font-weight: 600;
          font-size: 14px;
          color: #1f2937;
          flex: 1;
          margin: 0;
        }
        .node-details-close {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 16px;
          line-height: 1;
          transition: all 0.2s ease;
        }
        .node-details-close:hover {
          background: rgba(148, 163, 184, 0.2);
          color: #374151;
        }
        .node-details-content {
          padding: 16px;
          overflow-y: auto;
          max-height: 320px;
        }
        .node-details-description {
          font-size: 14px;
          line-height: 1.5;
          color: #4b5563;
          margin: 0 0 12px 0;
        }
        .node-details-meta {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .node-details-badge {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <div class="title-overlay">
            <h1>${title}</h1>
        </div>
        
        <!-- Node Details Panel -->
        <div id="nodeDetailsPanel" class="node-details-panel">
            <div class="node-details-header">
                <h4 id="nodeDetailsTitle" class="node-details-title">Node Title</h4>
                <button class="node-details-close" onclick="closeNodeDetails()">×</button>
            </div>
            <div class="node-details-content">
                <p id="nodeDetailsDescription" class="node-details-description"></p>
                <div class="node-details-meta">
                    <span id="nodeDetailsLevel" class="node-details-badge">Level 0</span>
                    <span id="nodeDetailsChildren" class="node-details-badge">0 children</span>
                </div>
            </div>
        </div>
        
        <svg class="mind-map-svg" viewBox="-1500 -1500 3000 3000" preserveAspectRatio="xMidYMid meet">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5" opacity="0.3"/>
                </pattern>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            
            <!-- Background grid -->
            <rect x="-1500" y="-1500" width="3000" height="3000" fill="url(#grid)" />
            
            <!-- Connections -->
            <g class="connections">
                ${connections}
            </g>
            
            <!-- Nodes -->
            <g class="nodes">
                ${nodes}
            </g>
        </svg>
        
        <div class="zoom-controls">
            <button class="zoom-btn" onclick="zoomIn()">+</button>
            <button class="zoom-btn" onclick="zoomOut()">−</button>
            <button class="zoom-btn" onclick="resetZoom()">⌂</button>
        </div>
    </div>

    <script>
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let selectedNodeId = null;
        
        const svg = document.querySelector('.mind-map-svg');
        const nodeDetailsPanel = document.getElementById('nodeDetailsPanel');
        
        // Store node data for details panel
        const nodeData = ${JSON.stringify(allNodes)};
        
        function updateTransform() {
            svg.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
        }
        
        function zoomIn() {
            scale = Math.min(scale * 1.2, 10);
            updateTransform();
        }
        
        function zoomOut() {
            scale = Math.max(scale / 1.2, 0.1);
            updateTransform();
        }
        
        function resetZoom() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        }
        
        function showNodeDetails(nodeId) {
            const node = nodeData.find(n => n.id === nodeId);
            if (!node) return;
            
            // Update panel content
            document.getElementById('nodeDetailsTitle').textContent = node.label || 'Untitled';
            document.getElementById('nodeDetailsDescription').textContent = node.description || 'No description available.';
            document.getElementById('nodeDetailsLevel').textContent = \`Level \${node.level}\`;
            
            // Count children
            const childrenCount = nodeData.filter(n => n.parentId === nodeId).length;
            document.getElementById('nodeDetailsChildren').textContent = \`\${childrenCount} children\`;
            
            // Show panel
            nodeDetailsPanel.classList.add('show');
            selectedNodeId = nodeId;
        }
        
        function closeNodeDetails() {
            nodeDetailsPanel.classList.remove('show');
            selectedNodeId = null;
        }
        
        // Mouse wheel zoom
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.max(0.1, Math.min(10, scale * delta));
            updateTransform();
        });
        
        // Pan functionality
        svg.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node-group')) return; // Don't pan when clicking nodes
            isDragging = true;
            dragStart.x = e.clientX - translateX;
            dragStart.y = e.clientY - translateY;
            svg.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                translateX = e.clientX - dragStart.x;
                translateY = e.clientY - dragStart.y;
                updateTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            svg.style.cursor = 'grab';
        });
        
        // Node click interactions
        document.querySelectorAll('.node-group').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = node.getAttribute('data-node-id');
                
                if (selectedNodeId === nodeId) {
                    // Close if clicking the same node
                    closeNodeDetails();
                } else {
                    // Show details for the clicked node
                    showNodeDetails(nodeId);
                }
            });
        });
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.node-details-panel') && !e.target.closest('.node-group')) {
                closeNodeDetails();
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Helper function to find non-colliding positions (extracted from React component)
   */
  private _findNonCollidingPosition(baseX: number, baseY: number, angle: number, radius: number, existingPositions: any[]) {
    let x = baseX;
    let y = baseY;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      let collision = false;
      for (const pos of existingPositions) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < (radius + pos.radius + 20)) {
          collision = true;
          break;
        }
      }
      
      if (!collision) break;
      
      // Try a new position
      const offsetAngle = angle + (Math.random() - 0.5) * Math.PI * 0.5;
      const offsetDistance = 50 + Math.random() * 100;
      x = baseX + offsetDistance * Math.cos(offsetAngle);
      y = baseY + offsetDistance * Math.sin(offsetAngle);
      attempts++;
    }
    
    return { x, y };
  }
}

// Export a singleton instance
export const mindMapGenerationService = new MindMapGenerationService();