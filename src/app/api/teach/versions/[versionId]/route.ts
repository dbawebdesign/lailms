import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface VersionParams {
  params: Promise<{
    versionId: string;
  }>;
}

// GET a specific section version
export async function GET(request: Request, { params }: VersionParams) {
  try {
    const { versionId } = await params;
    if (!versionId) {
      return NextResponse.json({ error: 'Version ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: version, error } = await supabase
      .from('lesson_section_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Section version not found' }, { status: 404 });
      }
      console.error('Error fetching section version:', error);
      return NextResponse.json({ error: 'Failed to fetch section version', details: error.message }, { status: 500 });
    }

    return NextResponse.json(version);
  } catch (e: any) {
    console.error('Unexpected error GET /api/teach/versions/[versionId]:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
}

// POST to revert a section to a specific version's content
export async function POST(request: Request, { params }: VersionParams) {
  try {
    const { versionId } = await params;
    if (!versionId) {
      return NextResponse.json({ error: 'Version ID is required for reverting' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
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

    const { lesson_section_id: sectionId, content: targetContent } = targetVersion;

    // 2. Fetch the current content of the parent section to create a backup version
    const { data: currentSection, error: fetchCurrentError } = await supabase
      .from('lesson_sections')
      .select('content')
      .eq('id', sectionId)
      .single();

    if (fetchCurrentError || !currentSection) {
      console.error('Error fetching current section content for backup:', fetchCurrentError);
      return NextResponse.json({ error: 'Parent section not found or permission issue.', details: fetchCurrentError?.message }, { status: 404 });
    }

    // 3. Create a new version entry for the *current* content (backup before overwriting)
    if (currentSection.content && JSON.stringify(currentSection.content) !== JSON.stringify(targetContent)) {
        // Get the current max version number for this section
        const { data: maxVersionData, error: maxVersionError } = await supabase
          .from('lesson_section_versions')
          .select('version_number')
          .eq('lesson_section_id', sectionId)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersionNumber = maxVersionData ? maxVersionData.version_number + 1 : 1;

        const { error: backupVersionError } = await supabase
        .from('lesson_section_versions')
        .insert({
            lesson_section_id: sectionId,
            content: currentSection.content, 
            creator_user_id: creatorUserId,
            version_number: nextVersionNumber,
        });

        if (backupVersionError) {
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
      .eq('id', sectionId)
      .select('id, content, updated_at')
      .single();

    if (updateError) {
      console.error('Error reverting section content:', updateError);
      return NextResponse.json({ error: 'Failed to revert section content', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Section reverted successfully', updatedSection });

  } catch (e: any) {
    console.error('Unexpected error POST /api/teach/versions/[versionId] (revert):', e);
    return NextResponse.json({ error: 'An unexpected error occurred during revert.', details: e.message }, { status: 500 });
  }
} 