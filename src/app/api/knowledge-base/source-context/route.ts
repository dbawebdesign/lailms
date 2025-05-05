import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@learnologyai/types/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get('documentId');
  const chunkId = searchParams.get('chunkId');
  
  if (!documentId || !chunkId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }
  
  const cookieStore = await cookies();
  
  // Helper function to adapt Next.js cookies to Supabase
  const supabaseCookieMethods = {
    get(name: string) {
      return cookieStore.get(name)?.value
    },
    set(name: string, value: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value, ...options })
      } catch (error) {
        // Ignore error on Server Components
      }
    },
    remove(name: string, options: CookieOptions) {
      try {
        cookieStore.set({ name, value: '', ...options })
      } catch (error) {
        // Ignore error on Server Components
      }
    },
  }

  // Create client for user session
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: supabaseCookieMethods }
  )

  // Check user authentication
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('Error getting session:', sessionError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the target chunk
  const { data: chunk, error: chunkError } = await supabase
    .from('document_chunks')
    .select(`
      id,
      document_id,
      chunk_index,
      content,
      section,
      section_summary,
      chunk_summary,
      citation_key,
      metadata,
      documents:document_id (
        file_name,
        file_type,
        metadata
      )
    `)
    .eq('id', chunkId)
    .eq('document_id', documentId)
    .single();
  
  if (chunkError) {
    console.error('Error fetching chunk:', chunkError);
    return NextResponse.json({ error: 'Failed to retrieve source chunk' }, { status: 500 });
  }
  
  if (!chunk) {
    return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
  }
  
  // Check if user has access to this document's organization
  const { data: documentData, error: documentError } = await supabase
    .from('documents')
    .select('organisation_id')
    .eq('id', documentId)
    .single();
    
  if (documentError || !documentData) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  
  // Verify the user is in the same organization
  const { data: memberData, error: memberError } = await supabase
    .from('organisation_members')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('organisation_id', documentData.organisation_id)
    .single();
    
  if (memberError || !memberData) {
    return NextResponse.json({ error: 'Unauthorized to access this document' }, { status: 403 });
  }
  
  // Get surrounding context (previous and next chunks)
  const chunkIndex = chunk.chunk_index;
  
  const { data: contextChunks, error: contextError } = await supabase
    .from('document_chunks')
    .select(`
      id,
      chunk_index,
      content,
      section,
      metadata
    `)
    .eq('document_id', documentId)
    .in('chunk_index', [chunkIndex - 1, chunkIndex + 1])
    .order('chunk_index');
  
  if (contextError) {
    console.error('Error fetching context chunks:', contextError);
    // Continue without context chunks if there's an error
  }
  
  const previousChunk = contextChunks?.find(c => c.chunk_index === chunkIndex - 1) || null;
  const nextChunk = contextChunks?.find(c => c.chunk_index === chunkIndex + 1) || null;
  
  // Extract document title and other metadata
  const documentTitle = chunk.documents?.file_name || 
                        (chunk.metadata?.documentTitle as string) || 
                        'Untitled Document';
  
  // Special handling for YouTube timestamps if available
  let timestampInfo = null;
  if (chunk.metadata?.video_id && chunk.metadata?.offset) {
    timestampInfo = {
      videoId: chunk.metadata.video_id,
      timestamp: parseInt(chunk.metadata.offset),
      formattedTime: formatTimestamp(parseInt(chunk.metadata.offset))
    };
  }
  
  return NextResponse.json({
    chunk: {
      id: chunk.id,
      content: chunk.content,
      section: chunk.section,
      sectionSummary: chunk.section_summary,
      chunkSummary: chunk.chunk_summary,
      citationKey: chunk.citation_key,
      metadata: chunk.metadata
    },
    documentId: documentId,
    documentTitle,
    documentType: chunk.documents?.file_type,
    previousChunk,
    nextChunk,
    timestamp: timestampInfo
  });
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
} 