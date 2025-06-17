import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@/types/supabase'
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest } from 'next/server';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the expected structure for the user role check
interface MemberProfile {
  role: Database['public']['Enums']['role']
}

// Define the structure for vector search results
interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  chunk_index: number;
  document_id: string;
  file_name: string;
  file_type: string;
  document_metadata: Record<string, any>;
  similarity: number;
  citation_key?: string;
  section?: string;
  chunk_summary?: string;
}

/**
 * Generates a citation key for a chunk if one doesn't exist
 */
function generateCitationKey(chunk: VectorSearchResult): string {
  if (chunk.citation_key) {
    return chunk.citation_key;
  }
  
  // Generate a citation key based on document title/name and chunk index
  const docTitle = chunk.metadata?.documentTitle || 
                  chunk.file_name || 
                  `Doc-${chunk.document_id.substring(0, 6)}`;
                  
  // Clean the title and make it URL-friendly
  const cleanTitle = docTitle
    .replace(/[^\w\s-]/g, '')  // Remove special characters
    .trim()
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .substring(0, 30);         // Limit length
    
  return `${cleanTitle}-${chunk.chunk_index}`;
}

/**
 * Extracts relevant context around query terms for highlighting
 */
function extractReferenceContext(chunk: VectorSearchResult, query: string): string | null {
  if (!chunk.content) return null;
  
  // Split the query into meaningful terms (ignoring common words)
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 3 && !['the', 'and', 'that', 'with', 'for', 'from'].includes(term));
  
  if (terms.length === 0) return null;
  
  // Find the first occurrence of any term
  const content = chunk.content.toLowerCase();
  let bestPos = -1;
  let bestTerm = '';
  
  for (const term of terms) {
    const pos = content.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
      bestTerm = term;
    }
  }
  
  if (bestPos === -1) return null;
  
  // Extract context around the match (up to 150 characters)
  const start = Math.max(0, bestPos - 75);
  const end = Math.min(content.length, bestPos + bestTerm.length + 75);
  
  // Get the original case version
  return chunk.content.substring(start, end) + (end < chunk.content.length ? '...' : '');
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Ignore error on Server Components (middleware handles refresh)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore error on Server Components (middleware handles refresh)
            }
          },
        },
      }
    );

    // Check user authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Error getting session:', sessionError)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization ID for the user
    const { data: memberData, error: memberError } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .single()

    if (memberError || !memberData?.organisation_id) {
      console.error('Error fetching member organization:', memberError)
      return NextResponse.json({ error: 'Could not determine user organization' }, { status: 403 })
    }

    const organisationId = memberData.organisation_id

    // Parse the search query from the request
    const { query, limit = 10, filter } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
    }

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536
    })

    const queryEmbeddingArray = embeddingResponse.data[0].embedding
    
    // Execute the vector similarity search using the RPC function
    const { data, error: searchError } = await (supabase as any).rpc(
      'vector_search',
      {
        query_embedding: queryEmbeddingArray, // Pass array directly, not as string
        organisation_id: organisationId,
        match_threshold: 0.5,
        match_count: limit
      }
    )
    
    if (searchError) {
      console.error('Error executing vector search:', searchError)
      
      // Fall back to a more basic search if vector search fails
      const { data: basicDocs, error: basicError } = await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          file_type,
          metadata
        `)
        .eq('organisation_id', organisationId)
        .limit(limit)
      
      if (basicError) {
        console.error('Error in fallback search:', basicError)
        return NextResponse.json({ error: 'Search functionality unavailable' }, { status: 500 })
      }
      
      // Map basicDocs to a structure somewhat consistent with VectorSearchResult for the client
      const fallbackResults = (basicDocs || []).map(doc => ({
        id: doc.id,
        chunk_id: doc.id, // No chunk_id for basic doc search, use doc.id
        document_id: doc.id,
        title: doc.file_name || 'Untitled Document',
        snippet: 'Basic document match. Full content not available in this view.',
        url: `/knowledge-base/documents/${doc.id}`, // Basic URL
        score: 0, // No similarity score
        metadata: doc.metadata || {},
        file_name: doc.file_name,
        file_type: doc.file_type,
        // Ensure other fields expected by VectorSearchResult if necessary, or handle downstream
      }));

      return NextResponse.json(
        fallbackResults,
        { status: 200 } 
        // Optionally include a message: 
        // { headers: { 'X-Search-Message': "Vector search unavailable, basic results shown." } }
      );
    }
    
    // If vector search is successful
    // Cast to unknown first to satisfy the linter
    const resultsData = data as unknown as VectorSearchResult[];
    const processedResults = resultsData.map(chunk => {
      const citationKey = generateCitationKey(chunk);
      const referenceContext = extractReferenceContext(chunk, query);
      return {
        ...chunk,
        citation_key: citationKey,
        reference_context: referenceContext
      };
    });
    
    // Apply post-processing filters if needed (e.g., filter by document type)
    let filteredResults = processedResults;
    
    if (filter?.documentType && filteredResults.length > 0) {
      filteredResults = filteredResults.filter(
        (result: VectorSearchResult) => result.file_type === filter.documentType
      )
    }
    
    if (filter?.documentId && filteredResults.length > 0) {
      filteredResults = filteredResults.filter(
        (result: VectorSearchResult) => result.document_id === filter.documentId
      )
    }
    
    // Generate a query ID for tracking this search
    const queryId = uuidv4();
    
    return NextResponse.json({
      results: filteredResults,
      query,
      queryId,
      count: filteredResults.length,
      method: 'vector_search'
    })
    
  } catch (error) {
    console.error('Unexpected error during search:', error)
    return NextResponse.json(
      { error: 'Failed to process search request' },
      { status: 500 }
    )
  }
} 