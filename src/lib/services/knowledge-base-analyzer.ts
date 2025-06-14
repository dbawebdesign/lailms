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
  private supabase: ReturnType<typeof createSupabaseServerClient>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = createSupabaseServerClient();
  }

  async analyzeKnowledgeBase(baseClassId: string): Promise<KnowledgeBaseAnalysis> {
    // 1. Get documents and chunks data
    const { data: documents, error: docsError } = await this.supabase
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

    const { data: chunks, error: chunksError } = await this.supabase
      .from('document_chunks')
      .select('id, document_id, content, chunk_summary, section_identifier')
      .in('document_id', documents?.map(d => d.id) || []);

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
        model: "gpt-4o-mini",
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
    const { data, error } = await this.supabase.rpc('search_knowledge_base', {
      query_text: query,
      base_class_filter: baseClassId,
      match_count: limit,
      similarity_threshold: 0.7
    });

    if (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }

    return data || [];
  }
}

export const knowledgeBaseAnalyzer = new KnowledgeBaseAnalyzer(); 