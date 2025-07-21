import { StudyContent, ContentType } from '@/types/study-content';
import { BaseContentExtractor } from './base-extractor';
import { LessonSectionExtractor } from './lesson-section-extractor';
import { MediaAssetExtractor } from './media-asset-extractor';

export class ContentExtractorFactory {
  private extractors: Map<ContentType, BaseContentExtractor>;

  constructor() {
    this.extractors = new Map();
    this.initializeExtractors();
  }

  private initializeExtractors(): void {
    // Register all available extractors
    this.registerExtractor(new LessonSectionExtractor());
    this.registerExtractor(new MediaAssetExtractor());
  }

  private registerExtractor(extractor: BaseContentExtractor): void {
    this.extractors.set(extractor.getContentType(), extractor);
  }

  /**
   * Get extractor for specific content type
   */
  getExtractor(contentType: ContentType): BaseContentExtractor | null {
    return this.extractors.get(contentType) || null;
  }

  /**
   * Extract content using appropriate extractor
   */
  async extractContent(
    source: any,
    contentType: ContentType,
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent | null> {
    const extractor = this.getExtractor(contentType);
    
    if (!extractor) {
      console.warn(`No extractor available for content type: ${contentType}`);
      return null;
    }

    if (!extractor.canProcess(source)) {
      console.warn(`Extractor cannot process source for type: ${contentType}`, source);
      return null;
    }

    try {
      return await extractor.extract(source, baseClassId, organisationId);
    } catch (error) {
      console.error(`Error extracting content (${contentType}):`, error);
      return null;
    }
  }

  /**
   * Batch extract lesson sections
   */
  async extractLessonSections(
    sections: any[],
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const extractor = this.getExtractor('section') as LessonSectionExtractor;
    if (!extractor) return [];

    return await extractor.extractBatch(sections, baseClassId, organisationId);
  }

  /**
   * Batch extract media assets
   */
  async extractMediaAssets(
    assets: any[],
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const extractor = this.getExtractor('media') as MediaAssetExtractor;
    if (!extractor) return [];

    return await extractor.extractBatch(assets, baseClassId, organisationId);
  }

  /**
   * Get all available content types
   */
  getAvailableContentTypes(): ContentType[] {
    return Array.from(this.extractors.keys());
  }

  /**
   * Check if extractor is available for content type
   */
  hasExtractor(contentType: ContentType): boolean {
    return this.extractors.has(contentType);
  }

  /**
   * Get extraction statistics
   */
  getExtractionStats(): Record<ContentType, { available: boolean; processed: number }> {
    const stats: Record<string, { available: boolean; processed: number }> = {};
    
    for (const contentType of this.extractors.keys()) {
      stats[contentType] = {
        available: true,
        processed: 0 // Could be enhanced with actual tracking
      };
    }

    return stats as Record<ContentType, { available: boolean; processed: number }>;
  }
}

// Singleton instance for reuse
export const contentExtractorFactory = new ContentExtractorFactory(); 