import { StudyContent, ContentType } from '@/types/study-content';
import { BaseContentExtractor } from './base-extractor';

export class LessonSectionExtractor extends BaseContentExtractor {
  getContentType(): ContentType {
    return 'section';
  }

  canProcess(source: any): boolean {
    return this.validateSource(source, ['id', 'lesson_id', 'title', 'content', 'section_type']);
  }

  async extract(source: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    if (!this.canProcess(source)) {
      throw new Error(`Invalid lesson section source: missing required fields`);
    }

    // Extract text content from TipTap JSON
    const textContent = this.extractTextFromTipTapJSON(source.content);
    const keywords = this.extractKeywords(textContent);

    // Create base content object
    const content = this.createBaseStudyContent(
      `section_${source.id}`,
      'section',
      'lesson_sections',
      source.id,
      baseClassId,
      organisationId,
      source.title,
      textContent
    );

    // Add section-specific properties
    content.lesson_id = source.lesson_id;
    content.parent_content_id = `lesson_${source.lesson_id}`;
    content.content_json = source.content;
    content.search_keywords = keywords;
    content.tags = this.formatTags([
      'section',
      source.section_type,
      ...keywords.slice(0, 5)
    ]);

    // Use existing embedding if available, otherwise generate new one
    if (source.content_embedding) {
      content.content_embedding = Array.from(source.content_embedding as any);
    } else if (textContent.length > 50) {
      // Only generate embedding for substantial content
      content.content_embedding = await this.generateEmbedding(textContent);
    }

    // Set progress tracking based on section type
    content.progress_trackable = ['lesson', 'reading', 'exercise', 'activity'].includes(source.section_type);

    // Extract media references if present
    content.media_asset_ids = this.extractMediaReferences(source.content);

    // Set timestamps from source
    content.created_at = source.created_at || content.created_at;
    content.updated_at = source.updated_at || content.updated_at;

    return content;
  }

  /**
   * Extract media asset references from TipTap content
   */
  private extractMediaReferences(content: any): string[] {
    const mediaIds: string[] = [];

    if (!content) return mediaIds;

    // Recursively search for media references in TipTap structure
    const searchForMedia = (node: any) => {
      if (!node) return;

      // Check for image nodes
      if (node.type === 'image' && node.attrs?.src) {
        // Extract ID from media URLs if they follow a pattern
        const mediaMatch = node.attrs.src.match(/media\/([a-f0-9-]+)/);
        if (mediaMatch) {
          mediaIds.push(mediaMatch[1]);
        }
      }

      // Check for video nodes
      if (node.type === 'video' && node.attrs?.src) {
        const mediaMatch = node.attrs.src.match(/media\/([a-f0-9-]+)/);
        if (mediaMatch) {
          mediaIds.push(mediaMatch[1]);
        }
      }

      // Check for custom media components
      if (node.type === 'mediaAsset' && node.attrs?.id) {
        mediaIds.push(node.attrs.id);
      }

      // Recursively search child nodes
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(searchForMedia);
      }
    };

    searchForMedia(content);
    return [...new Set(mediaIds)]; // Remove duplicates
  }

  /**
   * Batch extract multiple lesson sections
   */
  async extractBatch(
    sections: any[],
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const results: StudyContent[] = [];
    const batchSize = 5; // Process embeddings in small batches

    for (let i = 0; i < sections.length; i += batchSize) {
      const batch = sections.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (section) => {
        try {
          return await this.extract(section, baseClassId, organisationId);
        } catch (error) {
          console.error(`Error extracting section ${section.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean) as StudyContent[]);

      // Small delay between batches to respect rate limits
      if (i + batchSize < sections.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Get content complexity score based on text length and structure
   */
  getComplexityScore(source: any): number {
    if (!this.canProcess(source)) return 0;

    const textContent = this.extractTextFromTipTapJSON(source.content);
    const wordCount = textContent.split(/\s+/).length;
    
    // Base score on word count
    let score = Math.min(wordCount / 100, 10); // Max 10 points for word count

    // Bonus for rich content structure
    if (source.content && typeof source.content === 'object') {
      const contentStr = JSON.stringify(source.content);
      
      // Bonus for interactive elements
      if (contentStr.includes('"type":"video"')) score += 1;
      if (contentStr.includes('"type":"image"')) score += 0.5;
      if (contentStr.includes('"type":"codeBlock"')) score += 1;
      if (contentStr.includes('"type":"table"')) score += 0.5;
      if (contentStr.includes('"type":"bulletList"') || contentStr.includes('"type":"orderedList"')) score += 0.5;
    }

    return Math.min(score, 10); // Cap at 10
  }
} 