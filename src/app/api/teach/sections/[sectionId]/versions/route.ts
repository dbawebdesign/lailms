import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface SectionVersionsParams {
  params: Promise<{
    sectionId: string;
  }>;
}

// GET all versions for a specific lesson section
export async function GET(request: Request, { params }: SectionVersionsParams) {
  try {
    const { sectionId } = await params;
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    
    // First, check if the section itself exists and is accessible
    const { data: sectionExists, error: sectionCheckError } = await supabase
      .from('sections')
      .select('id')
      .eq('id', sectionId)
      .maybeSingle();

    if (sectionCheckError) {
      console.error('Error checking section existence:', sectionCheckError);
      return NextResponse.json({ error: 'Failed to verify section', details: sectionCheckError.message }, { status: 500 });
    }

    if (!sectionExists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
      
    // Now, fetch the versions for this section
    const { data: versions, error: versionsError } = await supabase
      .from('section_versions')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });

    if (versionsError) {
      console.error('Error fetching section versions:', versionsError);
      return NextResponse.json({ error: 'Failed to fetch section versions', details: versionsError.message }, { status: 500 });
    }

    return NextResponse.json(versions);
  } catch (e: any) {
    console.error('Unexpected error GET /api/teach/sections/[sectionId]/versions:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
} 