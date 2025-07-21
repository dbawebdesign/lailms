import { StudyContent, ContentType } from '@/types/study-content';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export abstract class BaseContentExtractor {
  protected supabase: ReturnType<typeof createSupabaseServerClient>;
  protected openai: OpenAI;

  constructor() {
    this.supabase = createSupabaseServerClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  abstract getContentType(): ContentType;
  abstract canProcess(source: any): boolean;
  abstract extract(source: any, baseClassId: string, organisationId: string): Promise<StudyContent>;

  /**
   * Extract keywords from text using simple word frequency analysis
   */
  protected extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // Simple keyword extraction - can be enhanced with NLP libraries
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Return unique words, limited to top 10
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'this', 'that', 'with', 'from', 'they', 'have', 'been', 'will',
      'would', 'could', 'should', 'there', 'their', 'where', 'when',
      'what', 'which', 'some', 'many', 'most', 'more', 'much', 'very',
      'also', 'just', 'only', 'even', 'well', 'back', 'still', 'way',
      'come', 'came', 'make', 'made', 'take', 'took', 'know', 'knew',
      'think', 'thought', 'see', 'saw', 'get', 'got', 'give', 'gave'
    ];
    
    return stopWords.includes(word);
  }

  /**
   * Extract text content from TipTap JSON structure
   */
  protected extractTextFromTipTapJSON(content: any): string {
    if (!content) return '';
    
    if (typeof content === 'string') return content;
    
    if (content.text) return content.text;
    
    if (content.content && Array.isArray(content.content)) {
      return content.content
        .map((node: any) => this.extractTextFromTipTapJSON(node))
        .filter(Boolean)
        .join('\n');
    }
    
    return '';
  }

  /**
   * Extract text from SVG content
   */
  protected extractTextFromSVG(svgContent: string): string {
    // Extract text from SVG content - simple regex approach
    const textMatches = svgContent.match(/<text[^>]*>(.*?)<\/text>/g) || [];
    return textMatches
      .map(match => match.replace(/<[^>]*>/g, ''))
      .join(' ');
  }

  /**
   * Extract text from JSON content
   */
  protected extractTextFromJSON(content: any): string {
    if (!content) return '';
    
    if (typeof content === 'string') return content;
    
    try {
      // Look for common text fields
      if (content.text) return content.text;
      if (content.description) return content.description;
      if (content.content) return this.extractTextFromJSON(content.content);
      
      // Fallback to JSON string representation
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }

  /**
   * Generate vector embedding for text
   */
  protected async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit text length
        dimensions: 1536
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return [];
    }
  }

  /**
   * Create a base StudyContent object with common properties
   */
  protected createBaseStudyContent(
    id: string,
    contentType: ContentType,
    sourceTable: string,
    sourceId: string,
    baseClassId: string,
    organisationId: string,
    title: string,
    contentText: string
  ): StudyContent {
    return {
      id,
      content_type: contentType,
      source_table: sourceTable,
      source_id: sourceId,
      base_class_id: baseClassId,
      organisation_id: organisationId,
      title,
      content_text: contentText,
      search_keywords: this.extractKeywords(contentText),
      tags: [contentType],
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: false,
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      indexed_at: new Date().toISOString()
    };
  }

  /**
   * Validate that a source object has required fields
   */
  protected validateSource(source: any, requiredFields: string[]): boolean {
    if (!source || typeof source !== 'object') return false;
    
    return requiredFields.every(field => 
      source.hasOwnProperty(field) && source[field] !== null && source[field] !== undefined
    );
  }

  /**
   * Safely get nested property from object
   */
  protected getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Format array of tags, filtering out null/undefined values
   */
  protected formatTags(tags: (string | null | undefined)[]): string[] {
    return tags.filter((tag): tag is string => Boolean(tag));
  }
} 