import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BaseClass } from '@/types/teach';

// TODO: Generate Supabase types and uncomment Database import above. 
// Example: npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/types/supabase.ts

export async function POST(
  request: NextRequest,
  { params }: { params: { baseClassId: string } }
) {
  // Destructure param from the helper argument first
  const { baseClassId } = params;
  
  // Verify that baseClassId is provided immediately after destructuring
  if (!baseClassId) {
    return NextResponse.json({ error: 'BaseClass ID is required' }, { status: 400 });
  }

  // NOW, Initialize Supabase client which carries the caller's auth cookie and is subject to RLS
  const supabase = createSupabaseServerClient();
  
  try {
    // Authenticate the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error(`Error fetching user in generate-lessons (baseClassId: ${baseClassId}):`, userError || 'User not found');
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: userError?.message || 'No user session found.' 
        }, 
        { status: 401 }
      );
    }

    // Fetch the base class using supabase client (RLS is OK for reading)
    const { data: baseClassData, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, organisation_id, settings')
      .eq('id', baseClassId)
      .single();

    if (baseClassError) {
      console.error('Error fetching base class:', baseClassError);
      return NextResponse.json({ error: 'Failed to fetch base class', details: baseClassError.message }, { status: 500 });
    }

    if (!baseClassData) {
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }
    
    const typedBaseClass = baseClassData as BaseClass;
    const generatedOutline = typedBaseClass.settings?.generatedOutline;

    if (!generatedOutline || !generatedOutline.modules || generatedOutline.modules.length === 0) {
      return NextResponse.json({ message: 'No modules found in generated outline, skipping path/lesson creation.' }, { status: 200 });
    }

    const createdPathsAndLessons = [];

    for (const [moduleIndex, module] of generatedOutline.modules.entries()) {
      // Use the authenticated user client. RLS policies will ensure proper access control.
      const { data: newPath, error: pathError } = await supabase
        .from('paths')
        .insert({
          title: module.title,
          description: module.description,
          base_class_id: baseClassId,
          organisation_id: typedBaseClass.organisation_id, 
          creator_user_id: user.id,
          order_index: moduleIndex,
        })
        .select('id, title') 
        .single();

      if (pathError) {
        console.error('Error creating path:', pathError);
        return NextResponse.json({ error: 'Failed to create path', details: pathError.message }, { status: 500 });
      }

      const lessonsForPath = [];
      if (module.suggestedLessons && newPath) {
        for (const [lessonIndex, lesson] of module.suggestedLessons.entries()) {
          // Use the authenticated user client. RLS policies will ensure proper access control.
          const { data: newLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              title: lesson.title,
              description: lesson.objective || lesson.description,
              path_id: newPath.id,
              creator_user_id: user.id,
              order_index: lessonIndex,
            })
            .select('id, title')
            .single();
          
          if (lessonError) {
            console.error('Error creating lesson:', lessonError);
            return NextResponse.json({ error: 'Failed to create lesson', details: lessonError.message }, { status: 500 });
          }
          if (newLesson) lessonsForPath.push(newLesson);
        }
      }
      if (newPath) createdPathsAndLessons.push({ path: newPath, lessons: lessonsForPath });
    }

    return NextResponse.json({ 
      message: 'Paths and lessons generated successfully', 
      data: createdPathsAndLessons 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in generate-lessons:', error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 