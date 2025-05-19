import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface SectionParams {
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
        async get(name: string) { 
          return (await cookieStore).get(name)?.value; 
        },
        async set(name: string, value: string, options: CookieOptions) { 
          (await cookieStore).set(name, value, options); 
        },
        async remove(name: string, options: CookieOptions) { 
          (await cookieStore).set(name, '', options); // Use set with empty value to remove
        },
      },
    }
  );
};

// GET a specific lesson section
export async function GET(request: Request, { params }: SectionParams) {
  try {
    const { sectionId } = params;
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    const { data: section, error } = await supabase
      .from('lesson_sections')
      .select('*')
      .eq('id', sectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Lesson section not found' }, { status: 404 });
      }
      console.error('Error fetching lesson section:', error);
      return NextResponse.json({ error: 'Failed to fetch lesson section', details: error.message }, { status: 500 });
    }

    return NextResponse.json(section);
  } catch (e: any) {
    console.error('Unexpected error GET /api/teach/sections/[sectionId]:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
}

// PUT (update) a specific lesson section
export async function PUT(request: Request, { params }: SectionParams) {
  try {
    const { sectionId } = params;
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const creatorUserId = user.id; 

    const body = await request.json();
    const { title, content, order_index, section_type } = body; 

    const { data: currentSection, error: fetchError } = await supabase
      .from('lesson_sections')
      .select('content, lesson_id') 
      .eq('id', sectionId)
      .single();

    if (fetchError || !currentSection) {
      console.error('Error fetching current section for versioning:', fetchError);
      return NextResponse.json({ error: 'Failed to find section to update or permission issue.', details: fetchError?.message }, { status: 404 });
    }
    
    if (currentSection.content && content && JSON.stringify(currentSection.content) !== JSON.stringify(content)) { 
        const { error: versionError } = await supabase
        .from('lesson_section_versions')
        .insert({
            lesson_section_id: sectionId,
            content: currentSection.content, 
            creator_user_id: creatorUserId,
        });

        if (versionError) {
            console.error('Error creating lesson section version:', versionError);
        }
    }

    const updateFields: { [key: string]: any } = {};
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    if (order_index !== undefined) updateFields.order_index = order_index;
    if (section_type !== undefined) updateFields.section_type = section_type;
    updateFields.updated_at = new Date().toISOString();

    if (Object.keys(updateFields).length === 1 && updateFields.updated_at) {
        return NextResponse.json({ error: "No fields to update provided beyond updated_at." }, { status: 400 });
    }
    
    const { data: updatedSection, error: updateError } = await supabase
      .from('lesson_sections')
      .update(updateFields)
      .eq('id', sectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lesson section:', updateError);
      return NextResponse.json({ error: 'Failed to update lesson section', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedSection);
  } catch (e: any) {
    console.error('Unexpected error PUT /api/teach/sections/[sectionId]:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
}

// DELETE a specific lesson section
export async function DELETE(request: Request, { params }: SectionParams) {
  try {
    const { sectionId } = params;
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const supabase = supabaseRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('lesson_sections')
      .delete()
      .eq('id', sectionId);

    if (deleteError) {
      console.error('Error deleting lesson section:', deleteError);
      return NextResponse.json({ error: 'Failed to delete lesson section', details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Lesson section deleted successfully' }, { status: 200 });
  } catch (e: any) {
    console.error('Unexpected error DELETE /api/teach/sections/[sectionId]:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: e.message }, { status: 500 });
  }
} 