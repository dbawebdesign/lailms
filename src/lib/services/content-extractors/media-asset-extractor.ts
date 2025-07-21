import { StudyContent, ContentType } from '@/types/study-content';
import { BaseContentExtractor } from './base-extractor';

export class MediaAssetExtractor extends BaseContentExtractor {
  getContentType(): ContentType {
    return 'media';
  }

  canProcess(source: any): boolean {
    return this.validateSource(source, ['id', 'lesson_id', 'title', 'asset_type']);
  }

  async extract(source: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    if (!this.canProcess(source)) {
      throw new Error(`Invalid media asset source: missing required fields`);
    }

    // Extract content text based on asset type
    const contentText = this.extractMediaContentText(source);
    
    // Create base content object
    const content = this.createBaseStudyContent(
      `media_${source.id}`,
      'media',
      'lesson_media_assets',
      source.id,
      baseClassId,
      organisationId,
      source.title,
      contentText
    );

    // Add media-specific properties
    content.lesson_id = source.lesson_id;
    content.parent_content_id = `lesson_${source.lesson_id}`;
    content.content_json = source.content;
    content.description = source.description;

    // Set tags based on asset type
    content.tags = this.formatTags([
      'media',
      source.asset_type,
      this.getMediaCategory(source.asset_type)
    ]);

    // Set estimated time based on asset type and duration
    content.estimated_time = this.calculateEstimatedTime(source);

    // Set progress tracking for time-based media
    content.progress_trackable = this.isProgressTrackable(source.asset_type);

    // Generate embedding for substantial text content
    if (contentText.length > 50) {
      content.content_embedding = await this.generateEmbedding(contentText);
    }

    // Set timestamps from source
    content.created_at = source.created_at || content.created_at;
    content.updated_at = source.updated_at || content.updated_at;

    return content;
  }

  /**
   * Extract searchable text content from different media asset types
   */
  private extractMediaContentText(source: any): string {
    let contentText = `${source.title}\nType: ${source.asset_type}`;

    if (source.description) {
      contentText += `\nDescription: ${source.description}`;
    }

    // Handle different asset types
    switch (source.asset_type) {
      case 'mind_map':
        contentText += this.extractMindMapContent(source);
        break;

      case 'podcast':
        contentText += this.extractPodcastContent(source);
        break;

      case 'video':
        contentText += this.extractVideoContent(source);
        break;

      case 'image':
        contentText += this.extractImageContent(source);
        break;

      case 'document':
        contentText += this.extractDocumentContent(source);
        break;

      case 'interactive':
        contentText += this.extractInteractiveContent(source);
        break;

      default:
        if (source.content) {
          contentText += `\n${this.extractTextFromJSON(source.content)}`;
        }
    }

    return contentText;
  }

  /**
   * Extract content from mind map assets
   */
  private extractMindMapContent(source: any): string {
    let content = '';

    // Extract from SVG content if available
    if (source.svg_content) {
      content += `\nMind Map Content: ${this.extractTextFromSVG(source.svg_content)}`;
    }

    // Extract from JSON structure if available
    if (source.content) {
      if (source.content.nodes) {
        const nodeTexts = source.content.nodes
          .map((node: any) => node.label || node.text || node.title)
          .filter(Boolean);
        content += `\nNodes: ${nodeTexts.join(', ')}`;
      }

      if (source.content.connections) {
        content += `\nConnections: ${source.content.connections.length} relationships`;
      }
    }

    return content;
  }

  /**
   * Extract content from podcast assets
   */
  private extractPodcastContent(source: any): string {
    let content = '';

    if (source.duration) {
      content += `\nDuration: ${Math.ceil(source.duration / 60)} minutes`;
    }

    if (source.content) {
      // Look for transcript or description
      if (source.content.transcript) {
        content += `\nTranscript: ${source.content.transcript}`;
      }
      
      if (source.content.summary) {
        content += `\nSummary: ${source.content.summary}`;
      }

      if (source.content.topics && Array.isArray(source.content.topics)) {
        content += `\nTopics: ${source.content.topics.join(', ')}`;
      }
    }

    return content;
  }

  /**
   * Extract content from video assets
   */
  private extractVideoContent(source: any): string {
    let content = '';

    if (source.duration) {
      content += `\nDuration: ${Math.ceil(source.duration / 60)} minutes`;
    }

    if (source.content) {
      if (source.content.transcript) {
        content += `\nTranscript: ${source.content.transcript}`;
      }

      if (source.content.captions) {
        content += `\nCaptions available`;
      }

      if (source.content.chapters && Array.isArray(source.content.chapters)) {
        const chapterTitles = source.content.chapters
          .map((chapter: any) => chapter.title)
          .filter(Boolean);
        content += `\nChapters: ${chapterTitles.join(', ')}`;
      }
    }

    return content;
  }

  /**
   * Extract content from image assets
   */
  private extractImageContent(source: any): string {
    let content = '';

    if (source.content) {
      if (source.content.alt_text) {
        content += `\nAlt Text: ${source.content.alt_text}`;
      }

      if (source.content.caption) {
        content += `\nCaption: ${source.content.caption}`;
      }

      if (source.content.tags && Array.isArray(source.content.tags)) {
        content += `\nTags: ${source.content.tags.join(', ')}`;
      }
    }

    return content;
  }

  /**
   * Extract content from document assets
   */
  private extractDocumentContent(source: any): string {
    let content = '';

    if (source.content) {
      if (source.content.text) {
        content += `\nContent: ${source.content.text}`;
      }

      if (source.content.summary) {
        content += `\nSummary: ${source.content.summary}`;
      }
    }

    return content;
  }

  /**
   * Extract content from interactive assets
   */
  private extractInteractiveContent(source: any): string {
    let content = '';

    if (source.content) {
      if (source.content.instructions) {
        content += `\nInstructions: ${source.content.instructions}`;
      }

      if (source.content.objectives && Array.isArray(source.content.objectives)) {
        content += `\nObjectives: ${source.content.objectives.join(', ')}`;
      }
    }

    return content;
  }

  /**
   * Get media category for tagging
   */
  private getMediaCategory(assetType: string): string {
    const categoryMap: Record<string, string> = {
      'mind_map': 'visual',
      'podcast': 'audio',
      'video': 'video',
      'image': 'visual',
      'document': 'text',
      'interactive': 'interactive',
      'animation': 'visual',
      'simulation': 'interactive'
    };

    return categoryMap[assetType] || 'other';
  }

  /**
   * Calculate estimated time to consume media
   */
  private calculateEstimatedTime(source: any): number | undefined {
    // If duration is provided, use it (convert seconds to minutes)
    if (source.duration && typeof source.duration === 'number') {
      return Math.ceil(source.duration / 60);
    }

    // Estimate based on asset type
    const estimateMap: Record<string, number> = {
      'mind_map': 5,      // 5 minutes to study
      'image': 2,         // 2 minutes to examine
      'document': 10,     // 10 minutes to read
      'interactive': 15,  // 15 minutes to complete
      'animation': 3,     // 3 minutes to watch
      'simulation': 20    // 20 minutes to explore
    };

    return estimateMap[source.asset_type];
  }

  /**
   * Determine if media asset supports progress tracking
   */
  private isProgressTrackable(assetType: string): boolean {
    const trackableTypes = [
      'podcast',
      'video', 
      'interactive',
      'simulation',
      'animation'
    ];

    return trackableTypes.includes(assetType);
  }

  /**
   * Batch extract multiple media assets
   */
  async extractBatch(
    assets: any[],
    baseClassId: string,
    organisationId: string
  ): Promise<StudyContent[]> {
    const results: StudyContent[] = [];
    const batchSize = 3; // Smaller batches for media processing

    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (asset) => {
        try {
          return await this.extract(asset, baseClassId, organisationId);
        } catch (error) {
          console.error(`Error extracting media asset ${asset.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean) as StudyContent[]);

      // Delay between batches
      if (i + batchSize < assets.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return results;
  }
} 