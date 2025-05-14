import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface SectionVersionsParams {
  params: {
    sectionId: string;
  };
}

// Helper function (can be moved to a shared lib utils later)
const supabaseRouteHandlerClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options); },
        remove(name: string, options: CookieOptions) { cookieStore.delete(name, options); },
      },
    }
  );
};

// GET all versions for a specific lesson section
export async function GET(request: Request, { params }: SectionVersionsParams) {
  try {
    const { sectionId } = params;
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    
    // First, check if the section itself exists and is accessible
    // This implicitly respects RLS on lesson_sections if properly configured
    const { data: sectionExists, error: sectionCheckError } = await supabase
      .from('lesson_sections')
      .select('id')
      .eq('id', sectionId)
      .maybeSingle();

    if (sectionCheckError) {
      console.error('Error checking section existence:', sectionCheckError);
      return NextResponse.json({ error: 'Failed to verify section', details: sectionCheckError.message }, { status: 500 });
    }

    if (!sectionExists) {
      return NextResponse.json({ error: 'Lesson section not found' }, { status: 404 });
    }
      
    // Now, fetch the versions for this section
    const { data: versions, error: versionsError } = await supabase
      .from('lesson_section_versions')
      .select('*') // Consider selecting specific fields if not all are needed
      .eq('lesson_section_id', sectionId)
      .order('version_number', { ascending: false }); // Show newest first

    if (versionsError) {
      console.error('Error fetching lesson section versions:', versionsError);
      return NextResponse.json({ error: 'Failed to fetch lesson section versions', details: versionsError.message }, { status: 500 });
    }

    return NextResponse.json(versions);
  } catch (e: any) {
    console.error('Unexpected error GET /api/teach/sections/[sectionId]/versions:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
} 