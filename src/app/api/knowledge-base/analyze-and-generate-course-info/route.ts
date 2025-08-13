import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { Tables } from 'packages/types/db';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Type definitions
interface DocumentChunk {
  content: string;
  metadata?: any;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string | null;
  status: string;
  metadata?: any;
  created_at: string;
  document_chunks?: DocumentChunk[];
}

// Helper function to wait for documents to be processed
async function waitForDocumentProcessing(
  supabase: ReturnType<typeof createSupabaseServerClient>, 
  organisationId: string, 
  baseClassId: string,
  maxWaitTime: number = 10 * 60 * 1000 // 10 minutes max wait
): Promise<Document[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check for documents associated with this base class
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_type,
        status,
        metadata,
        created_at,
        document_chunks!inner(content, metadata)
      `)
      .eq('organisation_id', organisationId)
      .eq('base_class_id', baseClassId)
      .order('created_at', { ascending: false })
      .returns<Tables<'documents'>[]>();

    if (error) {
      console.error('Error checking document status:', error);
      throw new Error('Failed to check document processing status');
    }

    if (documents && documents.length > 0) {
      // Check if all documents are completed
      const completedDocs = documents.filter((doc: Document) => doc.status === 'completed');
      const processingDocs = documents.filter((doc: Document) => 
        doc.status === 'processing' || doc.status === 'pending'
      );
      
      console.log(`Document status check: ${completedDocs.length} completed, ${processingDocs.length} processing`);
      
      if (processingDocs.length === 0 && completedDocs.length > 0) {
        // All documents are completed
        return completedDocs;
      }
      
      if (completedDocs.length > 0 && processingDocs.length > 0) {
        // Friendly status update: still processing N docs
        console.log(`Waiting for remaining documents to finish: ${processingDocs.length} still processing`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // If we get here, we've timed out - return whatever we have
  const { data: finalDocuments } = await supabase
    .from('documents')
    .select(`
      id,
      file_name,
      file_type,
      status,
      metadata,
      created_at,
      document_chunks!inner(content, metadata)
    `)
    .eq('organisation_id', organisationId)
    .eq('base_class_id', baseClassId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .returns<Tables<'documents'>[]>();
    
  return finalDocuments || [];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { baseClassId, organisationId, instructions } = body;

    // Validate required fields
    if (!baseClassId || !organisationId) {
      return NextResponse.json(
        { error: 'Base class ID and organisation ID are required' }, 
        { status: 400 }
      );
    }

    console.log(`Starting comprehensive analysis for base class ${baseClassId}`);

    // Wait for all documents to be processed (up to 10 minutes). If timeout, return friendly message with remaining count.
    const documents = await waitForDocumentProcessing(supabase, organisationId, baseClassId);

    if (!documents || documents.length === 0) {
      // Determine how many are still processing to give a friendly UI message
      const { data: allDocs } = await supabase
        .from('documents')
        .select('id, status')
        .eq('organisation_id', organisationId)
        .eq('base_class_id', baseClassId);

      const total = allDocs?.length || 0;
      const remaining = (allDocs || []).filter((d: any) => d.status === 'queued' || d.status === 'processing').length;
      return NextResponse.json(
        { 
          success: false,
          pending: remaining,
          total,
          error: remaining > 0 
            ? `Still processing ${remaining} of ${total} document(s).` 
            : 'No processed documents found for this base class. Please ensure documents are uploaded and processing has completed.'
        }, 
        { status: 202 }
      );
    }

    console.log(`Found ${documents.length} processed documents for comprehensive analysis`);

    // Prepare comprehensive content for analysis - combine all sources
    const allContent = documents
      .map((doc: Document) => {
        const chunkTexts = doc.document_chunks?.map((chunk: DocumentChunk) => chunk.content).join('\n') || '';
        return {
          title: doc.file_name,
          type: doc.file_type || 'unknown',
          content: chunkTexts,
          metadata: doc.metadata,
          wordCount: chunkTexts.split(/\s+/).length
        };
      })
      .filter(doc => doc.content && doc.content.length > 100) // Only include substantial content
      .sort((a, b) => b.wordCount - a.wordCount); // Prioritize larger documents

    if (allContent.length === 0) {
      return NextResponse.json(
        { error: 'No substantial content found for analysis in the processed documents' }, 
        { status: 400 }
      );
    }

    // Create a comprehensive content summary for analysis
    const totalWords = allContent.reduce((sum, doc) => sum + doc.wordCount, 0);
    const contentSummary = allContent.map(doc => ({
      title: doc.title,
      type: doc.type,
      wordCount: doc.wordCount,
      preview: doc.content.substring(0, 1500) // Longer preview for better analysis
    }));

    // Enhanced analysis prompt for comprehensive multi-source analysis
    const analysisPrompt = `
You are an expert educational content analyst tasked with creating a comprehensive course from multiple knowledge sources.

COMPREHENSIVE KNOWLEDGE BASE ANALYSIS:
Total Sources: ${allContent.length}
Total Content: ~${totalWords.toLocaleString()} words
Source Types: ${[...new Set(allContent.map(doc => doc.type))].join(', ')}

${instructions ? `
INSTRUCTOR GUIDANCE:
The course creator has provided specific instructions for how to analyze and use these sources:
"${instructions}"

Please follow these instructions carefully when analyzing the content and creating the course information.
` : ''}

SOURCE MATERIALS:
${contentSummary.map((doc, i) => `
Source ${i + 1}: ${doc.title}
Type: ${doc.type}
Length: ~${doc.wordCount} words
Content Preview:
${doc.preview}
---`).join('\n')}

ANALYSIS REQUIREMENTS:
Analyze ALL sources comprehensively as a unified knowledge base to create a cohesive course${instructions ? ', following the instructor guidance provided above' : ''}. Consider:

1. **Thematic Unity**: Identify the overarching themes that connect all sources
2. **Content Depth**: Assess the collective knowledge depth across all materials
3. **Learning Scope**: Determine what can be taught from this combined knowledge
4. **Audience Alignment**: Who would benefit most from this comprehensive content${instructions ? ' (considering the instructor guidance)' : ''}
5. **Knowledge Gaps**: Identify areas where the sources complement each other

Generate course information that reflects the COMPLETE knowledge base${instructions ? ' and aligns with the instructor guidance' : ''}:

1. **Course Name**: A title that captures the unified theme of ALL sources
2. **Course Description**: 2-3 paragraphs explaining the comprehensive learning experience
3. **Subject**: The primary discipline that encompasses all content
4. **Target Audience**: Based on collective content complexity and focus
5. **Learning Objectives**: 6-8 objectives that span the breadth of all sources

IMPORTANT: The course should feel like a unified learning experience, not a collection of disparate topics. Find the connecting threads and create coherence.

Respond ONLY with valid JSON in this exact format:
{
  "name": "Comprehensive Course Title",
  "description": "Multi-paragraph description that captures the unified learning experience from all sources...",
  "subject": "Primary Subject Area",
  "targetAudience": "Detailed target audience based on collective content complexity",
  "learningObjectives": [
    "Comprehensive objective 1 spanning multiple sources",
    "Comprehensive objective 2 spanning multiple sources", 
    "Comprehensive objective 3 spanning multiple sources",
    "Comprehensive objective 4 spanning multiple sources",
    "Comprehensive objective 5 spanning multiple sources",
    "Comprehensive objective 6 spanning multiple sources"
  ]
}`;

    try {
      console.log('Sending comprehensive analysis request to OpenAI...');
      
      // Call OpenAI for comprehensive content analysis
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content analyst specializing in creating unified courses from multiple knowledge sources. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000 // Increased for more comprehensive analysis
      });

      const analysisResult = completion.choices[0]?.message?.content;
      if (!analysisResult) {
        throw new Error('No analysis result from AI');
      }

      console.log('Received analysis result, parsing...');

      // Parse the JSON response (handle markdown code blocks)
      let courseInfo;
      try {
        // Remove markdown code block wrapper if present
        let cleanedResult = analysisResult.trim();
        if (cleanedResult.startsWith('```json')) {
          cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResult.startsWith('```')) {
          cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        courseInfo = JSON.parse(cleanedResult);
      } catch (parseError) {
        console.error('Failed to parse AI response:', analysisResult);
        console.error('Parse error:', parseError);
        throw new Error('Invalid AI response format');
      }

      // Validate the response structure
      const requiredFields = ['name', 'description', 'subject', 'targetAudience', 'learningObjectives'];
      for (const field of requiredFields) {
        if (!courseInfo[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (!Array.isArray(courseInfo.learningObjectives) || courseInfo.learningObjectives.length === 0) {
        throw new Error('Learning objectives must be a non-empty array');
      }

      console.log(`Comprehensive analysis completed successfully for ${documents.length} sources`);

      return NextResponse.json({ 
        success: true,
        courseInfo,
        analysisMetrics: {
          totalSources: documents.length,
          totalWords: totalWords,
          sourceTypes: [...new Set(allContent.map(doc => doc.type))],
          documentsAnalyzed: documents.length
        },
        message: `Comprehensive analysis completed successfully across ${documents.length} knowledge sources`
      });

    } catch (aiError) {
      console.error('AI comprehensive analysis error:', aiError);
      return NextResponse.json(
        { error: 'Failed to perform comprehensive content analysis with AI' }, 
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Comprehensive analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error during comprehensive analysis' }, 
      { status: 500 }
    );
  }
} 