import { createSupabaseServerClient } from '@/lib/supabase/server';
import { 
  StudyContent, 
  ContentType, 
  ContentAggregationOptions, 
  ContentIndexStats,
  ContentIndexingJob
} from '@/types/study-content';
import { StudioBaseClass, Path, Lesson, LessonSection } from '@/types/lesson';
import { contentExtractorFactory } from './content-extractors/extractor-factory';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class ContentAggregationService {
  private supabase: ReturnType<typeof createSupabaseServerClient>;

  constructor() {
    this.supabase = createSupabaseServerClient();
  }

  /**
   * Main aggregation function - processes all content for a base class
   */
  async aggregateClassContent(
    baseClassId: string, 
    organisationId: string,
    options: ContentAggregationOptions = {}
  ): Promise<ContentIndexStats> {
    const startTime = Date.now();
    const stats: ContentIndexStats = {
      total_items: 0,
      by_type: {} as Record<ContentType, number>,
      last_indexed: new Date().toISOString(),
      indexing_duration_ms: 0,
      errors: []
    };

    try {
      console.log(`Starting content aggregation for base class ${baseClassId}`);

      // Create indexing job record
      const jobId = await this.createIndexingJob(baseClassId, organisationId);
      
      const allContent: StudyContent[] = [];

      // Phase 1: Extract base class overview
      const baseClass = await this.getBaseClass(baseClassId);
      if (baseClass) {
        const courseContent = await this.extractCourseContent(baseClass);
        allContent.push(courseContent);
        console.log(`Extracted course content: ${courseContent.title}`);
      }

      // Phase 2: Extract all paths/modules and their content
      const paths = await this.getPathsByBaseClass(baseClassId);
      console.log(`Found ${paths.length} paths for base class ${baseClassId}`);

      for (const path of paths) {
        try {
          // Extract path content
          const moduleContent = await this.extractModuleContent(path, baseClassId, organisationId);
          allContent.push(moduleContent);

          // Extract lessons in this path
          const lessons = await this.getLessonsByPath(path.id);
          console.log(`Found ${lessons.length} lessons in path ${path.title}`);

          for (const lesson of lessons) {
            try {
              // Extract lesson content
              const lessonContent = await this.extractLessonContent(lesson, baseClassId, organisationId);
              allContent.push(lessonContent);

              // Extract lesson sections using specialized extractor
              const sections = await this.getSectionsByLesson(lesson.id);
              console.log(`Found ${sections.length} sections in lesson ${lesson.title}`);

              if (sections.length > 0) {
                try {
                  const sectionContents = await contentExtractorFactory.extractLessonSections(
                    sections, 
                    baseClassId, 
                    organisationId
                  );
                  allContent.push(...sectionContents);
                  console.log(`Extracted ${sectionContents.length} sections for lesson ${lesson.title}`);
                } catch (error) {
                  console.error(`Error extracting sections for lesson ${lesson.id}:`, error);
                  stats.errors.push(`Lesson ${lesson.title} sections: ${error}`);
                }
              }

              // Extract media assets using specialized extractor
              if (options.includeMediaAssets !== false) {
                const mediaAssets = await this.getMediaAssetsByLesson(lesson.id);
                if (mediaAssets.length > 0) {
                  try {
                    const mediaContents = await contentExtractorFactory.extractMediaAssets(
                      mediaAssets,
                      baseClassId,
                      organisationId
                    );
                    allContent.push(...mediaContents);
                    console.log(`Extracted ${mediaContents.length} media assets for lesson ${lesson.title}`);
                  } catch (error) {
                    console.error(`Error extracting media assets for lesson ${lesson.id}:`, error);
                    stats.errors.push(`Lesson ${lesson.title} media: ${error}`);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing lesson ${lesson.id}:`, error);
              stats.errors.push(`Lesson ${lesson.title}: ${error}`);
            }
          }
        } catch (error) {
          console.error(`Error processing path ${path.id}:`, error);
          stats.errors.push(`Path ${path.title}: ${error}`);
        }
      }

      // Phase 3: Extract knowledge base documents if requested
      if (options.includeDocuments !== false) {
        await this.extractDocumentContent(baseClassId, allContent, stats);
      }

      // Phase 4: Process and enhance all content
      console.log(`Processing ${allContent.length} content items...`);
      const processedContent = await this.processAggregatedContent(allContent);

      // Phase 5: Store in index
      await this.storeContentIndex(processedContent, options.forceReindex || false);

      // Update statistics
      stats.total_items = processedContent.length;
      processedContent.forEach(item => {
        stats.by_type[item.content_type] = (stats.by_type[item.content_type] || 0) + 1;
      });

      stats.indexing_duration_ms = Date.now() - startTime;
      
      // Update job completion
      await this.completeIndexingJob(jobId, stats);

      console.log(`Content aggregation completed for base class ${baseClassId}:`, stats);
      return stats;

    } catch (error) {
      console.error(`Content aggregation failed for base class ${baseClassId}:`, error);
      stats.errors.push(`Aggregation failed: ${error}`);
      stats.indexing_duration_ms = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Extract course-level content from base class
   */
  private async extractCourseContent(baseClass: StudioBaseClass): Promise<StudyContent> {
    const settingsText = this.extractSettingsText(baseClass.settings);
    const learningObjectives = this.extractLearningObjectives(baseClass.settings);
    const gradeLevel = this.extractGradeLevel(baseClass.settings);

    return {
      id: `course_${baseClass.id}`,
      content_type: 'course',
      source_table: 'base_classes',
      source_id: baseClass.id,
      base_class_id: baseClass.id,
      organisation_id: baseClass.organisation_id,
      title: baseClass.name,
      description: baseClass.description || undefined,
      content_text: `${baseClass.name}\n${baseClass.description || ''}\n${settingsText}`,
      content_json: baseClass.settings,
      search_keywords: this.extractKeywords(`${baseClass.name} ${baseClass.description || ''}`),
      tags: ['course', 'overview', gradeLevel].filter((tag): tag is string => Boolean(tag)),
      difficulty_level: gradeLevel,
      learning_objectives: learningObjectives,
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: true,
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: baseClass.created_at,
      updated_at: baseClass.updated_at,
      indexed_at: new Date().toISOString()
    };
  }

  /**
   * Extract module/path content
   */
  private async extractModuleContent(path: Path, baseClassId: string, organisationId: string): Promise<StudyContent> {
    return {
      id: `module_${path.id}`,
      content_type: 'module',
      source_table: 'paths',
      source_id: path.id,
      base_class_id: baseClassId,
      organisation_id: organisationId,
      path_id: path.id,
      parent_content_id: `course_${baseClassId}`,
      title: path.title,
      description: path.description || undefined,
      content_text: `Module: ${path.title}\n${path.description || ''}\nLevel: ${path.level || ''}`,
      search_keywords: this.extractKeywords(`${path.title} ${path.description || ''}`),
      tags: ['module', 'path', path.level].filter((tag): tag is string => Boolean(tag)),
      difficulty_level: path.level || undefined,
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: true,
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: path.created_at,
      updated_at: path.updated_at,
      indexed_at: new Date().toISOString()
    };
  }

  /**
   * Extract lesson content
   */
  private async extractLessonContent(lesson: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    // Note: teaching_outline_content may not exist on all lesson types
    const teachingOutline = (lesson as any).teaching_outline_content || '';
    
    return {
      id: `lesson_${lesson.id}`,
      content_type: 'lesson',
      source_table: 'lessons',
      source_id: lesson.id,
      base_class_id: baseClassId,
      organisation_id: organisationId,
      path_id: lesson.path_id,
      lesson_id: lesson.id,
      parent_content_id: `module_${lesson.path_id}`,
      title: lesson.title,
      description: lesson.description || undefined,
      content_text: `${lesson.title}\n${lesson.description || ''}\n${teachingOutline}`,
      search_keywords: this.extractKeywords(`${lesson.title} ${lesson.description || ''} ${teachingOutline}`),
      tags: ['lesson', lesson.level].filter((tag): tag is string => Boolean(tag)),
      difficulty_level: lesson.level || undefined,
      estimated_time: lesson.estimated_time || undefined,
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: true,
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: lesson.created_at,
      updated_at: lesson.updated_at,
      indexed_at: new Date().toISOString()
    };
  }

  /**
   * Extract section content (most detailed)
   */
  private async extractSectionContent(section: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    const textContent = this.extractTextFromTipTapJSON(section.content);
    const keywords = this.extractKeywords(textContent);
    
    return {
      id: `section_${section.id}`,
      content_type: 'section',
      source_table: 'lesson_sections',
      source_id: section.id,
      base_class_id: baseClassId,
      organisation_id: organisationId,
      lesson_id: section.lesson_id,
      parent_content_id: `lesson_${section.lesson_id}`,
      title: section.title,
      content_text: textContent,
      content_json: section.content,
      content_embedding: section.content_embedding ? Array.from(section.content_embedding as any) : undefined,
      search_keywords: keywords,
      tags: [section.section_type, ...keywords.slice(0, 5)],
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: true,
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: section.created_at,
      updated_at: section.updated_at,
      indexed_at: new Date().toISOString()
    };
  }

  /**
   * Extract media asset content
   */
  private async extractMediaContent(asset: any, baseClassId: string, organisationId: string): Promise<StudyContent> {
    let contentText = `${asset.title}\nType: ${asset.asset_type}`;
    
    if (asset.asset_type === 'mind_map' && asset.svg_content) {
      contentText += `\n${this.extractTextFromSVG(asset.svg_content)}`;
    }
    if (asset.content) {
      contentText += `\n${this.extractTextFromJSON(asset.content)}`;
    }
    
    return {
      id: `media_${asset.id}`,
      content_type: 'media',
      source_table: 'lesson_media_assets',
      source_id: asset.id,
      base_class_id: baseClassId,
      organisation_id: organisationId,
      lesson_id: asset.lesson_id,
      parent_content_id: `lesson_${asset.lesson_id}`,
      title: asset.title,
      content_text: contentText,
      content_json: asset.content,
      search_keywords: this.extractKeywords(contentText),
      tags: [asset.asset_type, 'media'],
      estimated_time: asset.duration ? Math.ceil(asset.duration / 60) : undefined,
      is_bookmarkable: true,
      is_notable: true,
      progress_trackable: asset.asset_type === 'podcast',
      related_content_ids: [],
      assessment_ids: [],
      media_asset_ids: [],
      created_at: asset.created_at || new Date().toISOString(),
      updated_at: asset.updated_at || new Date().toISOString(),
      indexed_at: new Date().toISOString()
    };
  }

  // Database query methods
  private async getBaseClass(baseClassId: string): Promise<StudioBaseClass | null> {
    const { data, error } = await this.supabase
      .from('base_classes')
      .select('*')
      .eq('id', baseClassId)
      .single();
      
    if (error) {
      console.error('Error fetching base class:', error);
      return null;
    }
    
    return data;
  }

  private async getPathsByBaseClass(baseClassId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('paths')
      .select('*')
      .eq('base_class_id', baseClassId)
      .order('order_index', { ascending: true });
      
    if (error) {
      console.error('Error fetching paths:', error);
      return [];
    }
    
    return data || [];
  }

  private async getLessonsByPath(pathId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('lessons')
      .select('*')
      .eq('path_id', pathId)
      .order('order_index', { ascending: true });
      
    if (error) {
      console.error('Error fetching lessons:', error);
      return [];
    }
    
    return data || [];
  }

  private async getSectionsByLesson(lessonId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('lesson_sections')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });
      
    if (error) {
      console.error('Error fetching sections:', error);
      return [];
    }
    
    return data || [];
  }

  private async getMediaAssetsByLesson(lessonId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('lesson_media_assets')
      .select('*')
      .eq('lesson_id', lessonId);
      
    if (error) {
      console.error('Error fetching media assets:', error);
      return [];
    }
    
    return data || [];
  }

  // Content processing methods
  private async processAggregatedContent(content: StudyContent[]): Promise<StudyContent[]> {
    const batchSize = 10;
    const processed: StudyContent[] = [];

    for (let i = 0; i < content.length; i += batchSize) {
      const batch = content.slice(i, i + batchSize);
      const batchProcessed = await Promise.all(
        batch.map(async (item) => {
          // Generate embeddings if not exist
          if (!item.content_embedding || item.content_embedding.length === 0) {
            try {
              item.content_embedding = await this.generateEmbedding(item.content_text);
            } catch (error) {
              console.error(`Error generating embedding for ${item.id}:`, error);
            }
          }
          
          // Set indexing timestamp
          item.indexed_at = new Date().toISOString();
          
          return item;
        })
      );
      
      processed.push(...batchProcessed);
      
      // Small delay to respect rate limits
      if (i + batchSize < content.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return processed;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit text length
      dimensions: 1536
    });
    
    return response.data[0].embedding;
  }

  // Helper methods for text extraction
  private extractTextFromTipTapJSON(content: any): string {
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

  private extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // Simple keyword extraction - can be enhanced with NLP libraries
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will'].includes(word));
    
    // Return unique words, limited to top 10
    return [...new Set(words)].slice(0, 10);
  }

  private extractSettingsText(settings: any): string {
    if (!settings) return '';
    
    try {
      return JSON.stringify(settings, null, 2);
    } catch {
      return String(settings);
    }
  }

  private extractLearningObjectives(settings: any): string[] {
    if (!settings) return [];
    
    // Look for common objective fields
    const objectives = settings.learningObjectives || 
                     settings.objectives || 
                     settings.goals || 
                     [];
    
    return Array.isArray(objectives) ? objectives : [];
  }

  private extractGradeLevel(settings: any): string | undefined {
    if (!settings) return undefined;
    
    return settings.gradeLevel || 
           settings.grade_level || 
           settings.level || 
           undefined;
  }

  private extractTextFromSVG(svgContent: string): string {
    // Extract text from SVG content - simple regex approach
    const textMatches = svgContent.match(/<text[^>]*>(.*?)<\/text>/g) || [];
    return textMatches
      .map(match => match.replace(/<[^>]*>/g, ''))
      .join(' ');
  }

  private extractTextFromJSON(content: any): string {
    if (!content) return '';
    
    if (typeof content === 'string') return content;
    
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }

  // Document content extraction using existing infrastructure
  private async extractDocumentContent(baseClassId: string, allContent: StudyContent[], stats: ContentIndexStats): Promise<void> {
    try {
      console.log(`Extracting document content for base class ${baseClassId}`);
      
      // Get documents associated with this base class
      const { data: documents, error: docError } = await this.supabase
        .from('documents')
        .select(`
          id, file_name, metadata, created_at, updated_at,
          document_chunks!inner(
            id, content, embedding, chunk_index, metadata
          )
        `)
        .eq('base_class_id', baseClassId);

      if (docError) {
        console.error('Error fetching documents:', docError);
        stats.errors.push(`Document fetch error: ${docError.message}`);
        return;
      }

      if (!documents || documents.length === 0) {
        console.log('No documents found for this base class');
        return;
      }

      // Process each document and its chunks
      for (const doc of documents as any[]) {
        try {
          // Extract title from file_name or metadata
          const title = doc.file_name || 'Untitled Document';
          const description = doc.metadata?.description || doc.metadata?.title || undefined;
          
          // Create document-level content
          const docContent: StudyContent = {
            id: `document_${doc.id}`,
            content_type: 'document',
            source_table: 'documents',
            source_id: doc.id,
            base_class_id: baseClassId,
            organisation_id: '', // Will be set by caller
            title: title,
            description: description,
            content_text: title + (description ? `\n${description}` : ''),
            search_keywords: this.extractKeywords(title + ' ' + (description || '')),
            tags: ['document', 'knowledge-base'],
            is_bookmarkable: true,
            is_notable: true,
            progress_trackable: false,
            related_content_ids: [],
            assessment_ids: [],
            media_asset_ids: [],
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            indexed_at: new Date().toISOString()
          };

          allContent.push(docContent);

          // Process document chunks as individual searchable content
          if (doc.document_chunks && Array.isArray(doc.document_chunks)) {
            for (const chunk of doc.document_chunks as any[]) {
              const chunkContent: StudyContent = {
                id: `chunk_${chunk.id}`,
                content_type: 'document',
                source_table: 'document_chunks',
                source_id: chunk.id,
                base_class_id: baseClassId,
                organisation_id: '', // Will be set by caller
                parent_content_id: `document_${doc.id}`,
                title: `${title} - Part ${chunk.chunk_index + 1}`,
                content_text: chunk.content,
                content_embedding: chunk.embedding ? Array.from(chunk.embedding as any) : undefined,
                search_keywords: this.extractKeywords(chunk.content),
                tags: ['document', 'chunk', 'knowledge-base'],
                is_bookmarkable: true,
                is_notable: true,
                progress_trackable: false,
                related_content_ids: [],
                assessment_ids: [],
                media_asset_ids: [],
                created_at: doc.created_at,
                updated_at: doc.updated_at,
                indexed_at: new Date().toISOString()
              };

              allContent.push(chunkContent);
            }
          }

          console.log(`Processed document: ${title} with ${doc.document_chunks?.length || 0} chunks`);
        } catch (error) {
          console.error(`Error processing document ${doc.id}:`, error);
          stats.errors.push(`Document ${doc.file_name}: ${error}`);
        }
      }

      console.log(`Document extraction completed: ${documents.length} documents processed`);
    } catch (error) {
      console.error('Document extraction failed:', error);
      stats.errors.push(`Document extraction failed: ${error}`);
    }
  }

  private async storeContentIndex(content: StudyContent[], forceReindex: boolean): Promise<void> {
    try {
      console.log(`Storing ${content.length} content items in study_content_index`);
      
      const batchSize = 50; // Process in smaller batches for better performance
      
      for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);
        
        // Prepare data for insertion
        const insertData = batch.map(item => ({
          base_class_id: item.base_class_id,
          organisation_id: item.organisation_id,
          content_type: item.content_type,
          source_table: item.source_table,
          source_id: item.source_id,
          path_id: item.path_id || null,
          lesson_id: item.lesson_id || null,
          parent_content_id: item.parent_content_id || null,
          title: item.title,
          description: item.description || null,
          content_text: item.content_text,
          content_json: item.content_json || null,
          content_embedding: item.content_embedding ? JSON.stringify(item.content_embedding) : null,
          search_keywords: item.search_keywords,
          tags: item.tags,
          difficulty_level: item.difficulty_level || null,
          estimated_time: item.estimated_time || null,
          learning_objectives: item.learning_objectives || null,
          prerequisites: item.prerequisites || null,
          is_bookmarkable: item.is_bookmarkable,
          is_notable: item.is_notable,
          progress_trackable: item.progress_trackable,
          related_content_ids: item.related_content_ids,
          assessment_ids: item.assessment_ids,
          media_asset_ids: item.media_asset_ids,
          created_at: item.created_at,
          updated_at: item.updated_at,
          indexed_at: item.indexed_at
        }));

        if (forceReindex) {
          // Delete existing content for this base class first
          if (i === 0) { // Only do this once for the first batch
            const { error: deleteError } = await this.supabase
              .from('study_content_index')
              .delete()
              .eq('base_class_id', batch[0].base_class_id);

            if (deleteError) {
              console.error('Error deleting existing content index:', deleteError);
              throw new Error(`Failed to clear existing index: ${deleteError.message}`);
            }
            
            console.log('Cleared existing content index for reindexing');
          }
        }

        // Insert new content
        const { error: insertError } = await this.supabase
          .from('study_content_index')
          .upsert(insertData, {
            onConflict: 'source_table,source_id,base_class_id',
            ignoreDuplicates: false
          });

        if (insertError) {
          console.error('Error inserting content batch:', insertError);
          throw new Error(`Failed to insert content batch: ${insertError.message}`);
        }

        console.log(`Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(content.length / batchSize)}`);
        
        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < content.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Successfully stored ${content.length} content items in study_content_index`);
    } catch (error) {
      console.error('Failed to store content index:', error);
      throw error;
    }
  }

  private async createIndexingJob(baseClassId: string, organisationId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('content_indexing_jobs')
        .insert({
          base_class_id: baseClassId,
          organisation_id: organisationId,
          status: 'processing',
          progress: 0,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating indexing job:', error);
        throw new Error(`Failed to create indexing job: ${error.message}`);
      }

      const jobId = data.id;
      console.log(`Created indexing job: ${jobId}`);
      return jobId;
    } catch (error) {
      console.error('Failed to create indexing job:', error);
      // Return a fallback ID if job creation fails
      return `fallback_${Date.now()}_${baseClassId}`;
    }
  }

  private async completeIndexingJob(jobId: string, stats: ContentIndexStats): Promise<void> {
    try {
      // Skip if this is a fallback job ID
      if (jobId.startsWith('fallback_')) {
        console.log('Skipping job completion for fallback job ID');
        return;
      }

      const { error } = await this.supabase
        .from('content_indexing_jobs')
        .update({
          status: stats.errors.length > 0 ? 'completed' : 'completed', // Could differentiate based on errors
          progress: 100,
          total_items: stats.total_items,
          processed_items: stats.total_items,
          stats: stats as any,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Error updating indexing job:', error);
      } else {
        console.log(`Completed indexing job: ${jobId}`, stats);
      }
    } catch (error) {
      console.error('Failed to complete indexing job:', error);
    }
  }
} 