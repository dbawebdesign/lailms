import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { baseClassId } = await params;
    
    // Create Supabase client
    const supabase = createServerClient(
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
              // Ignore error on Server Components
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore error on Server Components
            }
          },
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch base class information
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, name, description, settings, organisation_id, created_at')
      .eq('id', baseClassId)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }

    // Count total lessons - lessons are linked through paths to base classes
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, paths!inner(base_class_id)')
      .eq('paths.base_class_id', baseClassId);

    const totalLessons = lessonsData?.length || 0;
    
    if (lessonsError) {
      console.error('Error counting lessons:', lessonsError);
    }

    // Count total lesson sections - get lesson IDs first, then count their sections
    let totalSections = 0;
    
    if (lessonsData && lessonsData.length > 0) {
      const lessonIds = lessonsData.map(lesson => lesson.id);
      
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('lesson_sections')
        .select('id')
        .in('lesson_id', lessonIds);

      if (sectionsError) {
        console.error('Error counting sections:', sectionsError);
      } else {
        totalSections = sectionsData?.length || 0;
      }
    }

    return NextResponse.json({
      id: baseClass.id,
      name: baseClass.name,
      description: baseClass.description,
      settings: baseClass.settings,
      organisation_id: baseClass.organisation_id,
      created_at: baseClass.created_at,
      totalLessons: totalLessons,
      totalSections: totalSections
    });

  } catch (error) {
    console.error('Base class info API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch base class information' }, 
      { status: 500 }
    );
  }
} 