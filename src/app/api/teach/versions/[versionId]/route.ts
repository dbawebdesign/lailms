import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface VersionParams {
  params: {
    versionId: string;
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

// GET a specific lesson section version
export async function GET(request: Request, { params }: VersionParams) {
  try {
    const { versionId } = params;
    if (!versionId) {
      return NextResponse.json({ error: 'Version ID is required' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    const { data: version, error } = await supabase
      .from('lesson_section_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Lesson section version not found' }, { status: 404 });
      }
      console.error('Error fetching lesson section version:', error);
      return NextResponse.json({ error: 'Failed to fetch lesson section version', details: error.message }, { status: 500 });
    }

    return NextResponse.json(version);
  } catch (e: any) {
    console.error('Unexpected error GET /api/teach/versions/[versionId]:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
}

// POST to revert a lesson section to a specific version's content
export async function POST(request: Request, { params }: VersionParams) {
  try {
    const { versionId } = params;
    if (!versionId) {
      return NextResponse.json({ error: 'Version ID is required for reverting' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const creatorUserId = user.id;

    // 1. Fetch the target version to revert to
    const { data: targetVersion, error: fetchTargetError } = await supabase
      .from('lesson_section_versions')
      .select('lesson_section_id, content')
      .eq('id', versionId)
      .single();

    if (fetchTargetError || !targetVersion) {
      console.error('Error fetching target version for revert:', fetchTargetError);
      return NextResponse.json({ error: 'Target version not found or permission issue.', details: fetchTargetError?.message }, { status: 404 });
    }

    const { lesson_section_id: lessonSectionId, content: targetContent } = targetVersion;

    // 2. Fetch the current content of the parent lesson section to create a backup version
    const { data: currentSection, error: fetchCurrentError } = await supabase
      .from('lesson_sections')
      .select('content, lesson_id') // lesson_id might be useful for RLS or further checks
      .eq('id', lessonSectionId)
      .single();

    if (fetchCurrentError || !currentSection) {
      console.error('Error fetching current section content for backup:', fetchCurrentError);
      return NextResponse.json({ error: 'Parent lesson section not found or permission issue.', details: fetchCurrentError?.message }, { status: 404 });
    }

    // 3. Create a new version entry for the *current* content (backup before overwriting)
    //    Only if the current content is different from the target version content
    if (currentSection.content && JSON.stringify(currentSection.content) !== JSON.stringify(targetContent)) {
        const { error: backupVersionError } = await supabase
        .from('lesson_section_versions')
        .insert({
            lesson_section_id: lessonSectionId,
            content: currentSection.content, 
            creator_user_id: creatorUserId, // The user performing the revert action
        });

        if (backupVersionError) {
            // Log the error, but proceed with the revert if the user has permission
            console.error('Error creating backup version during revert:', backupVersionError);
        }
    }

    // 4. Update the parent lesson_sections.content with the content from the target version
    const { data: updatedSection, error: updateError } = await supabase
      .from('lesson_sections')
      .update({
        content: targetContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lessonSectionId)
      .select('id, content, updated_at') // return the updated section fields
      .single();

    if (updateError) {
      console.error('Error reverting lesson section content:', updateError);
      return NextResponse.json({ error: 'Failed to revert lesson section content', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Lesson section reverted successfully', updatedSection });

  } catch (e: any) {
    console.error('Unexpected error POST /api/teach/versions/[versionId] (revert):', e);
    return NextResponse.json({ error: 'An unexpected error occurred during revert.', details: e.message }, { status: 500 });
  }
} 