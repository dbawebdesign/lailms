import { NextResponse, NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Tables } from 'packages/types/db';
import { BaseClass } from '../../../../../../types/teach';

// TODO: Generate Supabase types and uncomment Database import above. 
// Example: npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/types/supabase.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ baseClassId: string }> }
) {
  // Destructure param from the helper argument first
  const { baseClassId } = await params;
  console.log(`[generate-lessons] Received request for baseClassId: ${baseClassId}`);

  // Verify that baseClassId is provided immediately after destructuring
  if (!baseClassId) {
    console.error("[generate-lessons] Error: BaseClass ID is required.");
    return NextResponse.json({ error: 'BaseClass ID is required' }, { status: 400 });
  }

  // NOW, Initialize Supabase client which carries the caller's auth cookie and is subject to RLS
  const supabase = createSupabaseServerClient();
  
  try {
    // Authenticate the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error(`[generate-lessons] Authentication error for baseClassId ${baseClassId}:`, userError || 'User not found');
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: userError?.message || 'No user session found.' 
        }, 
        { status: 401 }
      );
    }
    console.log(`[generate-lessons] User authenticated: ${user.id} for baseClassId: ${baseClassId}`);

    // Fetch the base class using supabase client (RLS is OK for reading)
    console.log(`[generate-lessons] Fetching base class data for ID: ${baseClassId}`);
    const { data: baseClassData, error: baseClassError } = await supabase
      .from('base_classes')
      .select('id, organisation_id, settings')
      .eq('id', baseClassId)
      .single<Tables<'base_classes'>>();

    if (baseClassError) {
      console.error(`[generate-lessons] Error fetching base class ${baseClassId}:`, baseClassError);
      return NextResponse.json({ error: 'Failed to fetch base class', details: baseClassError.message }, { status: 500 });
    }

    if (!baseClassData) {
      console.error(`[generate-lessons] Base class not found for ID: ${baseClassId}`);
      return NextResponse.json({ error: 'Base class not found' }, { status: 404 });
    }
    console.log(`[generate-lessons] Fetched baseClassData for ${baseClassId}:`, JSON.stringify(baseClassData, null, 2));
    
    const typedBaseClass = baseClassData as BaseClass;
    const settings = typedBaseClass.settings as any;
    const generatedOutline = settings?.generatedOutline;
    console.log(`[generate-lessons] Extracted generatedOutline for ${baseClassId}:`, JSON.stringify(generatedOutline, null, 2));

    if (!generatedOutline || !generatedOutline.modules || generatedOutline.modules.length === 0) {
      console.log(`[generate-lessons] No modules found in generated outline for ${baseClassId}, skipping path/lesson creation.`);
      return NextResponse.json({ message: 'No modules found in generated outline, skipping path/lesson creation.' }, { status: 200 });
    }

    const createdPathsAndLessons = [];

    for (const [moduleIndex, module] of generatedOutline.modules.entries()) {
      console.log(`[generate-lessons] Processing module ${moduleIndex + 1}/${generatedOutline.modules.length}: "${module.title}" for baseClassId: ${baseClassId}`);
      const pathInsertData = {
        title: module.title,
        description: module.description,
        base_class_id: baseClassId,
        organisation_id: typedBaseClass.organisation_id, 
        creator_user_id: user.id,
        order_index: moduleIndex,
      };
      console.log(`[generate-lessons] Attempting to insert path for module "${module.title}" with data:`, JSON.stringify(pathInsertData, null, 2));
      // Use the authenticated user client. RLS policies will ensure proper access control.
      const { data: newPath, error: pathError } = await supabase
        .from('paths')
        .insert(pathInsertData)
        .select('id, title') 
        .single<Tables<'paths'>>();

      if (pathError) {
        console.error(`[generate-lessons] Error creating path for module "${module.title}" (baseClassId: ${baseClassId}):`, pathError);
        return NextResponse.json({ error: 'Failed to create path', details: pathError.message }, { status: 500 });
      }
      console.log(`[generate-lessons] Successfully created path ID ${newPath?.id} for module "${module.title}" (baseClassId: ${baseClassId})`);

      const lessonsForPath = [];
      if (module.suggestedLessons && newPath) {
        console.log(`[generate-lessons] Module "${module.title}" has ${module.suggestedLessons.length} suggested lessons. Path ID: ${newPath.id}`);
        for (const [lessonIndex, lesson] of module.suggestedLessons.entries()) {
          console.log(`[generate-lessons] Processing lesson ${lessonIndex + 1}/${module.suggestedLessons.length}: "${lesson.title}" for path ID ${newPath.id}`);
          const lessonInsertData = {
            title: lesson.title,
            description: lesson.objective || lesson.description,
            path_id: newPath.id,
            creator_user_id: user.id,
            order_index: lessonIndex,
          };
          console.log(`[generate-lessons] Attempting to insert lesson "${lesson.title}" with data:`, JSON.stringify(lessonInsertData, null, 2));
          // Use the authenticated user client. RLS policies will ensure proper access control.
          const { data: newLesson, error: lessonError } = await supabase
            .from('lessons')
            .insert(lessonInsertData)
            .select('id, title')
            .single<Tables<'lessons'>>();
          
          if (lessonError) {
            console.error(`[generate-lessons] Error creating lesson "${lesson.title}" for path ID ${newPath.id} (baseClassId: ${baseClassId}):`, lessonError);
            return NextResponse.json({ error: 'Failed to create lesson', details: lessonError.message }, { status: 500 });
          }
          if (newLesson) {
            console.log(`[generate-lessons] Successfully created lesson ID ${newLesson.id} ("${lesson.title}") for path ID ${newPath.id}`);
            lessonsForPath.push(newLesson);
          }
        }
      } else {
        console.log(`[generate-lessons] No suggested lessons for module "${module.title}" or path creation failed. Path ID: ${newPath?.id}`);
      }
      if (newPath) createdPathsAndLessons.push({ path: newPath, lessons: lessonsForPath });
    }

    console.log(`[generate-lessons] Successfully generated paths and lessons for baseClassId: ${baseClassId}. Count:`, createdPathsAndLessons.length);
    return NextResponse.json({ 
      message: 'Paths and lessons generated successfully', 
      data: createdPathsAndLessons 
    }, { status: 201 });

  } catch (error: any) {
    console.error(`[generate-lessons] Unexpected error for baseClassId ${baseClassId}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
  }
} 