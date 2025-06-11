import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    
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

    const baseClassId = params.id;

    // Fetch base class information
    const { data: baseClass, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, name, description')
      .eq('id', baseClassId)
      .single();

    if (baseClassError || !baseClass) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }

    // Count total lessons
    const { count: totalLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id', { count: 'exact' })
      .eq('base_class_id', baseClassId);

    if (lessonsError) {
      console.error('Error counting lessons:', lessonsError);
    }

    // Count total lesson sections
    const { count: totalSections, error: sectionsError } = await supabase
      .from('lesson_sections')
      .select('lesson_id', { count: 'exact' })
      .eq('lessons.base_class_id', baseClassId);

    if (sectionsError) {
      console.error('Error counting sections:', sectionsError);
      // Try an alternative approach with join
      const { data: sectionsData, error: sectionsError2 } = await supabase
        .from('lesson_sections')
        .select('id, lessons!inner(base_class_id)')
        .eq('lessons.base_class_id', baseClassId);
      
      const alternativeTotalSections = sectionsData?.length || 0;
      
      return NextResponse.json({
        id: baseClass.id,
        name: baseClass.name,
        description: baseClass.description,
        totalLessons: totalLessons || 0,
        totalSections: alternativeTotalSections
      });
    }

    return NextResponse.json({
      id: baseClass.id,
      name: baseClass.name,
      description: baseClass.description,
      totalLessons: totalLessons || 0,
      totalSections: totalSections || 0
    });

  } catch (error) {
    console.error('Base class info API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch base class information' }, 
      { status: 500 }
    );
  }
} 