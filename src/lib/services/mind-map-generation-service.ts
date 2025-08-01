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

    console.log('🤖 [MindMapService] Calling OpenAI for mind map generation...');
    
    const aiResponse = await this.openai.chat.completions.create({
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
   * Generate interactive SVG mind map
   * (Simplified version - you can expand this as needed)
   */
  private _generateInteractiveSVGMindMap(data: any, title: string): string {
    // This is a simplified version. The full implementation would be quite large.
    // For now, we'll return a basic SVG structure that can be expanded later.
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Mind Map</title>
    <style>
        body { margin: 0; padding: 0; background: #1a1a2e; color: white; font-family: Arial, sans-serif; }
        .mind-map-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .center-node { background: #6B5DE5; padding: 20px; border-radius: 15px; text-align: center; }
        .branches { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
        .branch { background: #DC2626; padding: 10px; border-radius: 8px; margin: 5px; }
    </style>
</head>
<body>
    <div class="mind-map-container">
        <div>
            <div class="center-node">
                <h2>${data.center?.label || title}</h2>
                <p>${data.center?.description || ''}</p>
            </div>
            <div class="branches">
                ${(data.branches || []).map((branch: any) => `
                    <div class="branch" style="background-color: ${branch.color || '#DC2626'}">
                        <strong>${branch.label}</strong>
                        <p>${branch.description || ''}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
  }
}

// Export a singleton instance
export const mindMapGenerationService = new MindMapGenerationService();