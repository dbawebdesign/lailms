// @ts-nocheck
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export interface KnowledgeBaseAnalysis {
  baseClassId: string;
  totalDocuments: number;
  totalChunks: number;
  contentDepth: 'minimal' | 'moderate' | 'comprehensive';
  subjectCoverage: string[];
  recommendedGenerationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  analysisDetails: {
    documentTypes: Record<string, number>;
    averageChunksPerDocument: number;
    contentQuality: 'low' | 'medium' | 'high';
    conceptCoverage: string[];
    knowledgeGaps: string[];
    learningObjectives: string[];
  };
  createdAt: Date;
}

export interface CourseGenerationMode {
  mode: 'kb_only' | 'kb_priority' | 'kb_supplemented';
  title: string;
  description: string;
  guidance: string;
  aiInstructions: string;
}

export const COURSE_GENERATION_MODES: Record<string, CourseGenerationMode> = {
  kb_only: {
    mode: 'kb_only',
    title: 'Knowledge Base Only',
    description: 'Generate content exclusively from uploaded sources',
    guidance: 'Use this when you have comprehensive source materials and want to ensure complete fidelity to the provided content.',
    aiInstructions: 'You MUST ONLY use content from the provided knowledge base chunks. Do not add any external knowledge or general information. Every piece of content must be directly traceable to the source materials. If there is insufficient information in the knowledge base to cover a topic fully, indicate this gap rather than filling it with external knowledge.'
  },
  kb_priority: {
    mode: 'kb_priority',
    title: 'Knowledge Base Priority',
    description: 'Prioritize knowledge base content, fill minor gaps with general knowledge',
    guidance: 'Use this when you have good source materials but want to ensure a complete learning experience with minor supplementation.',
    aiInstructions: 'Primarily use content from the provided knowledge base chunks. Only supplement with general knowledge to fill small gaps or provide brief context where the knowledge base content requires it. Clearly distinguish between knowledge base content and supplemented information. The knowledge base should account for at least 80% of the generated content.'
  },
  kb_supplemented: {
    mode: 'kb_supplemented',
    title: 'Knowledge Base Supplemented',
    description: 'Use knowledge base as foundation, freely supplement with general knowledge',
    guidance: 'Use this when you have limited source materials or want to create a comprehensive course using the knowledge base as a starting point.',
    aiInstructions: 'Use the provided knowledge base chunks as a foundation and reference point, but freely supplement with general knowledge to create comprehensive, well-rounded content. Ensure the knowledge base content is prominently featured and referenced, but feel free to expand with additional context, examples, and explanations as needed for effective learning.'
  }
};

export class KnowledgeBaseAnalyzer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private getSupabaseClient() {
    return createSupabaseServerClient();
  }

  async analyzeKnowledgeBase(baseClassId: string): Promise<KnowledgeBaseAnalysis> {
    // 1. Get documents and chunks data
    const supabase = this.getSupabaseClient();
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_type,
        status,
        metadata,
        document_summaries (
          summary,
          summary_level
        )
      `)
      .eq('base_class_id', baseClassId)
      .eq('status', 'completed');

    if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, document_id, content, chunk_summary, section_identifier')
      .in('document_id', documents?.map((d: any) => d.id) || []);

    if (chunksError) throw new Error(`Failed to fetch chunks: ${chunksError.message}`);

    // 2. Basic metrics
    const totalDocuments = documents?.length || 0;
    const totalChunks = chunks?.length || 0;
    const averageChunksPerDocument = totalDocuments > 0 ? totalChunks / totalDocuments : 0;

    // 3. Document type analysis
    const documentTypes = documents?.reduce((acc, doc) => {
      const type = this.getDocumentType(doc.file_type, doc.file_name);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // 4. AI-powered content analysis
    const contentAnalysis = await this.analyzeContentWithAI(documents, chunks);

    // 5. Determine content depth and generation mode
    const contentDepth = this.determineContentDepth(totalDocuments, totalChunks, averageChunksPerDocument);
    const recommendedMode = this.recommendGenerationMode(contentDepth, totalDocuments, contentAnalysis.contentQuality);

    return {
      baseClassId,
      totalDocuments,
      totalChunks,
      contentDepth,
      subjectCoverage: contentAnalysis.subjectCoverage,
      recommendedGenerationMode: recommendedMode,
      analysisDetails: {
        documentTypes,
        averageChunksPerDocument,
        contentQuality: contentAnalysis.contentQuality,
        conceptCoverage: contentAnalysis.conceptCoverage,
        knowledgeGaps: contentAnalysis.knowledgeGaps,
        learningObjectives: contentAnalysis.learningObjectives,
      },
      createdAt: new Date(),
    };
  }

  private async analyzeContentWithAI(documents: any[], chunks: any[]) {
    // Prepare content sample for AI analysis
    const documentSummaries = documents
      ?.filter(d => d.document_summaries?.length > 0)
      ?.map(d => ({
        name: d.file_name,
        summary: d.document_summaries[0]?.summary
      })) || [];

    const chunkSamples = chunks?.slice(0, 10)?.map(c => ({
      content: c.content?.substring(0, 500),
      summary: c.chunk_summary
    })) || [];

    const analysisPrompt = `
Analyze the following educational content to determine:

1. Subject coverage areas
2. Content quality (low/medium/high)
3. Key concepts covered
4. Potential knowledge gaps
5. Suggested learning objectives

Documents:
${documentSummaries.map(d => `- ${d.name}: ${d.summary}`).join('\n')}

Sample Content:
${chunkSamples.map(c => `- ${c.summary || c.content}`).join('\n')}

Provide analysis in JSON format:
{
  "subjectCoverage": ["subject1", "subject2"],
  "contentQuality": "low|medium|high",
  "conceptCoverage": ["concept1", "concept2"],
  "knowledgeGaps": ["gap1", "gap2"],
  "learningObjectives": ["objective1", "objective2"]
}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are an educational content analyst. Analyze the provided content and return a JSON response only."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const analysis = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        subjectCoverage: analysis.subjectCoverage || [],
        contentQuality: analysis.contentQuality || 'medium',
        conceptCoverage: analysis.conceptCoverage || [],
        knowledgeGaps: analysis.knowledgeGaps || [],
        learningObjectives: analysis.learningObjectives || [],
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        subjectCoverage: ['General'],
        contentQuality: 'medium' as const,
        conceptCoverage: ['General concepts'],
        knowledgeGaps: ['Analysis unavailable'],
        learningObjectives: ['Learn from provided materials'],
      };
    }
  }

  private getDocumentType(fileType: string | null, fileName: string): string {
    if (!fileType && !fileName) return 'unknown';
    
    if (fileName?.includes('URL -')) return 'web_page';
    if (fileType?.includes('pdf')) return 'pdf';
    if (fileType?.includes('video')) return 'video';
    if (fileType?.includes('audio')) return 'audio';
    if (fileType?.includes('text')) return 'text';
    if (fileType?.includes('document')) return 'document';
    
    return 'other';
  }

  private determineContentDepth(totalDocs: number, totalChunks: number, avgChunks: number): 'minimal' | 'moderate' | 'comprehensive' {
    if (totalDocs === 0 || totalChunks === 0) return 'minimal';
    
    if (totalDocs >= 5 && avgChunks >= 15) return 'comprehensive';
    if (totalDocs >= 2 && avgChunks >= 8) return 'moderate';
    
    return 'minimal';
  }

  private recommendGenerationMode(
    contentDepth: 'minimal' | 'moderate' | 'comprehensive',
    totalDocs: number,
    contentQuality: 'low' | 'medium' | 'high'
  ): 'kb_only' | 'kb_priority' | 'kb_supplemented' {
    if (contentDepth === 'comprehensive' && contentQuality === 'high' && totalDocs >= 5) {
      return 'kb_only';
    }
    
    if (contentDepth === 'moderate' && contentQuality !== 'low') {
      return 'kb_priority';
    }
    
    return 'kb_supplemented';
  }

  async searchKnowledgeBase(
    baseClassId: string,
    query: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    content: string;
    summary?: string;
    document_name: string;
    section_identifier?: string;
    similarity: number;
  }>> {
    try {
      // First, get the organization ID for the base class
      const supabase = this.getSupabaseClient();
      const { data: baseClass, error: baseClassError } = await supabase
        .from('base_classes')
        .select('organisation_id')
        .eq('id', baseClassId)
        .single();

      if (baseClassError || !baseClass) {
        console.error('Failed to get base class:', baseClassError);
        return [];
      }

      // Generate embedding for the query using OpenAI
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Call the correct vector search function
      const { data, error } = await (supabase as any).rpc('vector_search_with_base_class', {
        query_embedding: queryEmbedding,
        organisation_id: baseClass.organisation_id,
        base_class_id: baseClassId,
        match_threshold: 0.5,
        match_count: limit
      });

      if (error) {
        console.error('Knowledge base search error:', error);
        return [];
      }

      // Transform the results to match the expected format
      return (data || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        summary: item.chunk_summary,
        document_name: item.file_name,
        section_identifier: item.section_identifier,
        similarity: item.similarity
      }));

    } catch (error) {
      console.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * Enhanced search function that adapts strategy based on generation mode
   */
  async searchKnowledgeBaseForGeneration(
    baseClassId: string,
    query: string,
    generationMode: 'kb_only' | 'kb_priority' | 'kb_supplemented',
    context?: {
      totalChunks?: number;
      courseScope?: 'outline' | 'lesson' | 'module';
    }
  ): Promise<Array<{
    id: string;
    content: string;
    summary?: string;
    document_name: string;
    section_identifier?: string;
    similarity: number;
    search_strategy?: string;
  }>> {
    try {
      const supabase = this.getSupabaseClient();
      
      // Get base class organization info
      const { data: baseClass, error: baseClassError } = await supabase
        .from('base_classes')
        .select('organisation_id')
        .eq('id', baseClassId)
        .single();

      if (baseClassError || !baseClass) {
        console.error('Failed to get base class:', baseClassError);
        return [];
      }

      // Determine search strategy based on generation mode
      const searchConfig = this.getSearchConfigForMode(generationMode, context);
      
      let allResults: any[] = [];
      const seenChunkIds = new Set<string>();

      // Execute multiple search strategies
      for (const strategy of searchConfig.strategies) {
        const strategyResults = await this.executeSearchStrategy(
          supabase,
          baseClass.organisation_id,
          baseClassId,
          query,
          strategy
        );

        // Add unique results
        for (const result of strategyResults) {
          if (!seenChunkIds.has(result.id)) {
            seenChunkIds.add(result.id);
            allResults.push({
              ...result,
              search_strategy: strategy.name
            });
          }
        }
      }

      // If no results found, use fallback strategy
      if (allResults.length === 0) {
        console.warn(`[KB Search] No vector search results found for query: "${query}". Using fallback strategy.`);
        allResults = await this.getFallbackChunks(supabase, baseClassId, searchConfig.maxResults);
      }

      // Sort by relevance and apply final filtering
      allResults.sort((a, b) => (b.similarity || 0.5) - (a.similarity || 0.5));
      
      // Apply mode-specific result selection
      const finalResults = this.selectResultsForMode(allResults, searchConfig);

      console.log(`[KB Search] Mode: ${generationMode}, Query: "${query}", Results: ${finalResults.length}/${allResults.length} chunks`);
      
      return finalResults.map((item: any) => ({
        id: item.id,
        content: item.content,
        summary: item.chunk_summary || item.summary,
        document_name: item.file_name,
        section_identifier: item.section_identifier,
        similarity: item.similarity || 0.5,
        search_strategy: item.search_strategy || 'fallback'
      }));

    } catch (error) {
      console.error('Enhanced knowledge base search failed:', error);
      // Return fallback chunks on any error
      return await this.getFallbackChunks(this.getSupabaseClient(), baseClassId, 10);
    }
  }

  private getSearchConfigForMode(
    mode: 'kb_only' | 'kb_priority' | 'kb_supplemented',
    context?: { totalChunks?: number; courseScope?: 'outline' | 'lesson' | 'module' }
  ) {
    const baseConfig = {
      'kb_only': {
        // Comprehensive coverage for KB-only generation
        strategies: [
          { name: 'high_relevance', threshold: 0.7, limit: 15 },
          { name: 'medium_relevance', threshold: 0.5, limit: 25 },
          { name: 'broad_coverage', threshold: 0.3, limit: 35 },
          { name: 'document_sampling', threshold: 0.0, limit: 10 } // Sample from each document
        ],
        maxResults: 50,
        ensureDocumentCoverage: true,
        requireMinimumChunks: true
      },
      'kb_priority': {
        // Balanced approach with good coverage
        strategies: [
          { name: 'high_relevance', threshold: 0.6, limit: 20 },
          { name: 'medium_relevance', threshold: 0.4, limit: 15 }
        ],
        maxResults: 30,
        ensureDocumentCoverage: false,
        requireMinimumChunks: false
      },
      'kb_supplemented': {
        // Focused on most relevant content
        strategies: [
          { name: 'high_relevance', threshold: 0.6, limit: 15 }
        ],
        maxResults: 15,
        ensureDocumentCoverage: false,
        requireMinimumChunks: false
      }
    };

    // Adjust based on context
    const config = baseConfig[mode];
    
    if (context?.courseScope === 'outline') {
      // For course outline, need broader coverage
      config.strategies.forEach(s => s.limit = Math.ceil(s.limit * 1.5));
      config.maxResults = Math.ceil(config.maxResults * 1.5);
    } else if (context?.courseScope === 'lesson') {
      // For individual lessons, can be more focused
      config.strategies.forEach(s => s.limit = Math.ceil(s.limit * 0.7));
      config.maxResults = Math.ceil(config.maxResults * 0.7);
    }

    return config;
  }

  private async executeSearchStrategy(
    supabase: any,
    organisationId: string,
    baseClassId: string,
    query: string,
    strategy: { name: string; threshold: number; limit: number }
  ): Promise<any[]> {
    try {
      // Generate embeddings for the query
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Execute vector search with strategy parameters
      const { data, error } = await (supabase as any).rpc('vector_search_with_base_class', {
        query_embedding: queryEmbedding,
        organisation_id: organisationId,
        base_class_id: baseClassId,
        match_threshold: strategy.threshold,
        match_count: strategy.limit
      });

      if (error) {
        console.warn(`Search strategy ${strategy.name} failed:`, error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.warn(`Error executing search strategy ${strategy.name}:`, error);
      return [];
    }
  }

  private selectResultsForMode(
    results: any[],
    config: {
      maxResults: number;
      ensureDocumentCoverage: boolean;
      requireMinimumChunks: boolean;
    }
  ): any[] {
    let selectedResults = [...results];

    // Apply document coverage requirement for KB-only mode
    if (config.ensureDocumentCoverage) {
      selectedResults = this.ensureDocumentRepresentation(selectedResults);
    }

    // Apply result limit
    selectedResults = selectedResults.slice(0, config.maxResults);

    // Ensure minimum chunk requirement for comprehensive modes
    if (config.requireMinimumChunks && selectedResults.length < 20) {
      console.warn(`Only ${selectedResults.length} chunks found for comprehensive KB generation. Consider reviewing knowledge base content.`);
    }

    return selectedResults;
  }

  private ensureDocumentRepresentation(results: any[]): any[] {
    // Group results by document
    const documentGroups = new Map<string, any[]>();
    
    for (const result of results) {
      const docId = result.document_id;
      if (!documentGroups.has(docId)) {
        documentGroups.set(docId, []);
      }
      documentGroups.get(docId)!.push(result);
    }

    // Ensure each document is represented
    const balancedResults: any[] = [];
    const documentsWithContent = Array.from(documentGroups.entries());
    
    // First pass: get best chunk from each document
    for (const [docId, docResults] of documentsWithContent) {
      const bestChunk = docResults.sort((a, b) => b.similarity - a.similarity)[0];
      balancedResults.push(bestChunk);
    }

    // Second pass: add remaining high-quality chunks
    const remainingResults = results.filter(r => 
      !balancedResults.some(br => br.id === r.id)
    );
    
    balancedResults.push(...remainingResults);

    return balancedResults;
  }

  /**
   * Fallback method to get sample chunks when vector search fails
   */
  private async getFallbackChunks(
    supabase: any,
    baseClassId: string,
    limit: number
  ): Promise<any[]> {
    try {
      // Get random sample of chunks for this base class
      const { data: chunks, error } = await supabase
        .from('document_chunks')
        .select(`
          id,
          content,
          chunk_summary,
          section_identifier,
          documents!inner(file_name, base_class_id)
        `)
        .eq('documents.base_class_id', baseClassId)
        .limit(limit);

      if (error) throw error;

      return (chunks || []).map((chunk: any) => ({
        id: chunk.id,
        content: chunk.content,
        chunk_summary: chunk.chunk_summary,
        file_name: chunk.documents?.file_name || 'Unknown',
        section_identifier: chunk.section_identifier,
        similarity: 0.5, // Default similarity for fallback
        search_strategy: 'fallback'
      }));

    } catch (error) {
      console.error('Fallback chunk retrieval failed:', error);
      return [];
    }
  }
}

export const knowledgeBaseAnalyzer = new KnowledgeBaseAnalyzer(); 